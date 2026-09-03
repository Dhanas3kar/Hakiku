import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { notificationOutbox, messageOutbox } from '../db/schema';
import { Redis } from 'ioredis';
import { monitorEventLoopDelay } from 'node:perf_hooks';

@Controller('health')
export class HealthController {
  private histogram = monitorEventLoopDelay({ resolution: 20 });

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.histogram.enable();
  }

  @Get('liveness')
  getLiveness() {
    const lagThresholdMs = Number(
      process.env.HEALTH_LIVENESS_EVENT_LOOP_THRESHOLD_MS || 2000,
    );
    const p95LagMs = this.histogram.percentile(95) / 1e6;

    if (p95LagMs > lagThresholdMs) {
      throw new HttpException(
        {
          status: 'unhealthy',
          reason: `Event loop lag (${p95LagMs.toFixed(1)}ms) exceeded threshold (${lagThresholdMs}ms)`,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'up',
      liveness: 'healthy',
      eventLoopLagMs: Number(p95LagMs.toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  async getReadiness() {
    const timeoutMs = Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 3000);
    const backlogThreshold = Number(
      process.env.HEALTH_OUTBOX_BACKLOG_THRESHOLD || 10000,
    );

    const checks: Record<string, 'up' | 'down' | 'degraded'> = {
      postgres: 'down',
      redis: 'down',
      outbox: 'down',
    };

    let isHealthy = true;

    // 1. PostgreSQL check
    try {
      await this.withTimeout(
        db.execute(sql`SELECT 1`),
        timeoutMs,
        'Postgres ping timeout',
      );
      checks.postgres = 'up';
    } catch (e) {
      checks.postgres = 'down';
      isHealthy = false;
    }

    // 2. Redis check
    try {
      const pingRes = await this.withTimeout(
        this.redis.ping(),
        timeoutMs,
        'Redis ping timeout',
      );
      if (pingRes === 'PONG') {
        checks.redis = 'up';
      } else {
        checks.redis = 'down';
        isHealthy = false;
      }
    } catch (e) {
      checks.redis = 'down';
      isHealthy = false;
    }

    // 3. Outbox Backlog Check
    try {
      const [notifRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationOutbox)
        .where(sql`status IN ('PENDING', 'PROCESSING')`);
      const [msgRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messageOutbox)
        .where(sql`status IN ('PENDING', 'PROCESSING')`);

      const totalPending = (notifRes?.count || 0) + (msgRes?.count || 0);

      if (totalPending > backlogThreshold) {
        checks.outbox = 'degraded';
      } else {
        checks.outbox = 'up';
      }
    } catch (e) {
      checks.outbox = 'down';
      // Outbox query failure does not mark readiness down if PG is up, but tracks state
    }

    if (!isHealthy) {
      throw new HttpException(
        {
          status: 'not_ready',
          checks,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    errorMsg: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMsg)), ms),
      ),
    ]);
  }
}
