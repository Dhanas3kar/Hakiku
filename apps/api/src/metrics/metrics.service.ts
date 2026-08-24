import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { sql } from 'drizzle-orm';
import { db } from '../db';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SystemMetrics');
  private intervalId: NodeJS.Timeout;
  private histogram = monitorEventLoopDelay({ resolution: 20 });

  // Aggregate HTTP counters
  private requestCount = 0;
  private error5xxCount = 0;

  onModuleInit() {
    this.histogram.enable();

    // Log metrics every 5 seconds
    this.intervalId = setInterval(() => this.logMetrics(), 5000);
  }

  onModuleDestroy() {
    this.histogram.disable();
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  public recordHttpRequest(statusCode: number) {
    this.requestCount++;
    if (statusCode >= 500 && statusCode < 600) {
      this.error5xxCount++;
    }
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
  };

  private async logMetrics() {
    // Memory
    const mem = process.memoryUsage();
    const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
    const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);

    // Event Loop Lag
    const p95Lag = (this.histogram.percentile(95) / 1e6).toFixed(2); // ms
    const maxLag = (this.histogram.max / 1e6).toFixed(2); // ms

    // HTTP RPS
    const rps = (this.requestCount / 5).toFixed(1);
    const errorRate =
      this.requestCount > 0
        ? ((this.error5xxCount / this.requestCount) * 100).toFixed(1)
        : '0.0';

    // Reset counters for the next 5s window
    this.requestCount = 0;
    this.error5xxCount = 0;

    // Database connections (Active and Idle)
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
      this.logger.error('Failed to fetch pg_stat_activity', e);
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
    };

    this.logger.log(
      `[Metrics] HTTP: ${rps} req/s (5xx: ${errorRate}%) | ` +
        `Node: EL_p95=${p95Lag}ms EL_max=${maxLag}ms RSS=${rssMB}MB Heap=${heapUsedMB}MB | ` +
        `PG: Active=${dbActive} Idle=${dbIdle}`,
    );

    // Reset event loop histogram for next window
    this.histogram.reset();
  }
}
