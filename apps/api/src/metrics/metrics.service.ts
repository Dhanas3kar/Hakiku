import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { notificationOutbox, messageOutbox } from '../db/schema';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SystemMetrics');
  private intervalId: NodeJS.Timeout | null = null;
  private histogram = monitorEventLoopDelay({ resolution: 20 });

  // Cumulative Counters
  private totalRequests = 0;
  private totalErrors5xx = 0;
  private totalDurationMs = 0;

  // Status code distribution counters
  private statusCounts: Record<string, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };

  // Windowed HTTP counters for 5s RPS logging
  private windowRequestCount = 0;
  private windowError5xxCount = 0;

  // Outbox & WS Telemetry
  private outboxProcessedCount = 0;
  private outboxFailedCount = 0;
  private activeWsConnections = 0;

  onModuleInit() {
    this.histogram.enable();
    const isTest = process.env.NODE_ENV === 'test';
    if (!isTest) {
      this.intervalId = setInterval(() => this.logMetrics(), 5000);
    }
  }

  onModuleDestroy() {
    this.histogram.disable();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public recordHttpRequest(statusCode: number, durationMs = 0) {
    this.totalRequests++;
    this.windowRequestCount++;
    this.totalDurationMs += durationMs;

    if (statusCode >= 200 && statusCode < 300) this.statusCounts['2xx']++;
    else if (statusCode >= 300 && statusCode < 400) this.statusCounts['3xx']++;
    else if (statusCode >= 400 && statusCode < 500) this.statusCounts['4xx']++;
    else if (statusCode >= 500 && statusCode < 600) {
      this.statusCounts['5xx']++;
      this.totalErrors5xx++;
      this.windowError5xxCount++;
    }
  }

  public recordOutboxProcessed(count = 1) {
    this.outboxProcessedCount += count;
  }

  public recordOutboxFailed(count = 1) {
    this.outboxFailedCount += count;
  }

  public incrementWsConnections() {
    this.activeWsConnections++;
  }

  public decrementWsConnections() {
    this.activeWsConnections = Math.max(0, this.activeWsConnections - 1);
  }

  public setWsConnections(count: number) {
    this.activeWsConnections = Math.max(0, count);
  }

  public currentMetrics = {
    rps: '0.0',
    errorRate: '0.0',
    p95Lag: '0.0',
    maxLag: '0.0',
    rssMB: '0.0',
    heapUsedMB: '0.0',
    dbActive: 0,
    dbIdle: 0,
    notificationOutboxPending: 0,
    messageOutboxPending: 0,
    wsConnections: 0,
  };

  private async logMetrics() {
    const mem = process.memoryUsage();
    const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
    const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);

    const p95Lag = (this.histogram.percentile(95) / 1e6).toFixed(2);
    const maxLag = (this.histogram.max / 1e6).toFixed(2);

    const rps = (this.windowRequestCount / 5).toFixed(1);
    const errorRate =
      this.windowRequestCount > 0
        ? ((this.windowError5xxCount / this.windowRequestCount) * 100).toFixed(1)
        : '0.0';

    this.windowRequestCount = 0;
    this.windowError5xxCount = 0;

    let dbActive = 0;
    let dbIdle = 0;
    try {
      const res = await db.execute(sql`
        SELECT state, count(*) 
        FROM pg_stat_activity 
        WHERE datname = current_database() 
        GROUP BY state
      `);

      for (const row of res) {
        if (row.state === 'active') dbActive += Number(row.count);
        else if (row.state === 'idle') dbIdle += Number(row.count);
      }
    } catch (e) {
      // Ignored in test / mock mode
    }

    let notificationOutboxPending = 0;
    let messageOutboxPending = 0;
    try {
      const [notifRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationOutbox)
        .where(sql`status IN ('PENDING', 'PROCESSING')`);
      notificationOutboxPending = notifRes?.count || 0;

      const [msgRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messageOutbox)
        .where(sql`status IN ('PENDING', 'PROCESSING')`);
      messageOutboxPending = msgRes?.count || 0;
    } catch (e) {
      // Ignored
    }

    this.currentMetrics = {
      rps,
      errorRate,
      p95Lag,
      maxLag,
      rssMB,
      heapUsedMB,
      dbActive,
      dbIdle,
      notificationOutboxPending,
      messageOutboxPending,
      wsConnections: this.activeWsConnections,
    };

    this.logger.log(
      `[Metrics] HTTP: ${rps} req/s (5xx: ${errorRate}%) | ` +
        `Node: EL_p95=${p95Lag}ms EL_max=${maxLag}ms RSS=${rssMB}MB Heap=${heapUsedMB}MB | ` +
        `PG: Active=${dbActive} Idle=${dbIdle} | WS: ${this.activeWsConnections}`,
    );

    this.histogram.reset();
  }

  /**
   * Formats current application telemetry into standard Prometheus text exposition format.
   */
  public async getPrometheusFormat(): Promise<string> {
    const mem = process.memoryUsage();
    const p95LagSec = (this.histogram.percentile(95) / 1e9).toFixed(6);
    const avgDurationSec =
      this.totalRequests > 0
        ? (this.totalDurationMs / this.totalRequests / 1000).toFixed(6)
        : '0.000000';

    let notificationOutboxPending = 0;
    let messageOutboxPending = 0;
    try {
      const [notifRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationOutbox)
        .where(sql`status IN ('PENDING', 'PROCESSING')`);
      notificationOutboxPending = notifRes?.count || 0;

      const [msgRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messageOutbox)
        .where(sql`status IN ('PENDING', 'PROCESSING')`);
      messageOutboxPending = msgRes?.count || 0;
    } catch (e) {
      // Ignored if DB table not present in test unit environment
    }

    let dbActive = 0;
    let dbIdle = 0;
    try {
      const res = await db.execute(sql`
        SELECT state, count(*) 
        FROM pg_stat_activity 
        WHERE datname = current_database() 
        GROUP BY state
      `);
      for (const row of res) {
        if (row.state === 'active') dbActive += Number(row.count);
        else if (row.state === 'idle') dbIdle += Number(row.count);
      }
    } catch (e) {
      // Ignored
    }

    const lines = [
      '# HELP hakiku_http_requests_total Total number of HTTP requests processed',
      '# TYPE hakiku_http_requests_total counter',
      `hakiku_http_requests_total{status="2xx"} ${this.statusCounts['2xx']}`,
      `hakiku_http_requests_total{status="3xx"} ${this.statusCounts['3xx']}`,
      `hakiku_http_requests_total{status="4xx"} ${this.statusCounts['4xx']}`,
      `hakiku_http_requests_total{status="5xx"} ${this.statusCounts['5xx']}`,
      '',
      '# HELP hakiku_http_request_duration_seconds Average HTTP request duration in seconds',
      '# TYPE hakiku_http_request_duration_seconds gauge',
      `hakiku_http_request_duration_seconds ${avgDurationSec}`,
      '',
      '# HELP hakiku_event_loop_lag_p95_seconds 95th percentile event loop lag in seconds',
      '# TYPE hakiku_event_loop_lag_p95_seconds gauge',
      `hakiku_event_loop_lag_p95_seconds ${p95LagSec}`,
      '',
      '# HELP hakiku_memory_rss_bytes Resident Set Size memory in bytes',
      '# TYPE hakiku_memory_rss_bytes gauge',
      `hakiku_memory_rss_bytes ${mem.rss}`,
      '',
      '# HELP hakiku_memory_heap_used_bytes Memory heap used in bytes',
      '# TYPE hakiku_memory_heap_used_bytes gauge',
      `hakiku_memory_heap_used_bytes ${mem.heapUsed}`,
      '',
      '# HELP hakiku_pg_connections_active Number of active PostgreSQL database connections',
      '# TYPE hakiku_pg_connections_active gauge',
      `hakiku_pg_connections_active ${dbActive}`,
      '',
      '# HELP hakiku_pg_connections_idle Number of idle PostgreSQL database connections',
      '# TYPE hakiku_pg_connections_idle gauge',
      `hakiku_pg_connections_idle ${dbIdle}`,
      '',
      '# HELP hakiku_notification_outbox_pending_total Pending notification outbox items',
      '# TYPE hakiku_notification_outbox_pending_total gauge',
      `hakiku_notification_outbox_pending_total ${notificationOutboxPending}`,
      '',
      '# HELP hakiku_message_outbox_pending_total Pending message outbox items',
      '# TYPE hakiku_message_outbox_pending_total gauge',
      `hakiku_message_outbox_pending_total ${messageOutboxPending}`,
      '',
      '# HELP hakiku_outbox_processed_total Total successfully processed outbox items',
      '# TYPE hakiku_outbox_processed_total counter',
      `hakiku_outbox_processed_total ${this.outboxProcessedCount}`,
      '',
      '# HELP hakiku_outbox_failed_total Total failed outbox processing attempts',
      '# TYPE hakiku_outbox_failed_total counter',
      `hakiku_outbox_failed_total ${this.outboxFailedCount}`,
      '',
      '# HELP hakiku_ws_connections Number of active WebSocket client connections',
      '# TYPE hakiku_ws_connections gauge',
      `hakiku_ws_connections ${this.activeWsConnections}`,
      '',
    ];

    return lines.join('\n');
  }
}
