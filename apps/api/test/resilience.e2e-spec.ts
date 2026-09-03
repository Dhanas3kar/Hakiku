import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';

import { AppModule } from '../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { db } from '../src/db';
import { notificationOutbox } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { NotificationWorkerService } from '../src/notifications/services/notification-worker.service';
import fastifyCookie from '@fastify/cookie';

describe('Resilience & Failure Scenarios (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.register(fastifyCookie, {
      secret: process.env.COOKIE_SECRET || 'test-secret',
    });
    
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Disable background workers for testing AFTER app.init()
    const worker = app.get(NotificationWorkerService);
    // @ts-ignore
    if (worker.intervalId) {
      // @ts-ignore
      clearInterval(worker.intervalId);
    }
    // @ts-ignore
    worker.isRunning = false;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Outbox Lease & Recovery', () => {
    it('should reset outbox row if handleEvent fails (fail-before-commit)', async () => {
      // 1. Insert a pending outbox row
      const [outboxRow] = await db.insert(notificationOutbox).values({
        eventId: 'test-fail-event-' + Date.now(),
        type: 'SYSTEM',
        payload: { message: 'test' },
        status: 'PENDING',
      }).returning();

      const worker = app.get(NotificationWorkerService);

      // Mock handleEvent to throw
      // @ts-ignore
      const originalHandleEvent = worker.handleEvent;
      // @ts-ignore
      worker.handleEvent = jest.fn().mockRejectedValue(new Error('Simulated failure'));

      // @ts-ignore
      worker.isRunning = true;
      // @ts-ignore
      await worker.processOutbox();
      // @ts-ignore
      worker.isRunning = false;
      // Verify it was returned to PENDING with attempts = 1
      const [updatedRow] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.id, outboxRow.id));
      
      expect(updatedRow.status).toBe('PENDING');
      expect(updatedRow.attempts).toBe(1);
      expect(updatedRow.lastError).toBe('Simulated failure');
      expect(updatedRow.claimedAt).toBeNull();
      expect(updatedRow.availableAt.getTime()).toBeGreaterThan(Date.now()); // exponential backoff

      // Restore
      // @ts-ignore
      worker.handleEvent = originalHandleEvent;
    });
  });

  describe('Global Exception Filter (Infrastructure Errors)', () => {
    it('should map Postgres timeout/connection errors to 503', async () => {
      // We will mock a repository method to throw a Postgres-like error
      // The easiest way is to mock a controller or service briefly.
      // But we can also just hit a non-existent route with a mocked guard, or mock `db.select`
      
      const originalSelect = db.select;
      
      // Mock db.select to throw 53300
      // @ts-ignore
      db.select = jest.fn().mockImplementation(() => {
        const err = new Error('too many connections');
        (err as any).code = '53300';
        throw err;
      });

      // Hit a route that triggers db.select, e.g. GET /feed or GET /notifications
      const res = await app.inject({
        method: 'GET',
        url: '/feed',
      });
      
      // Since it's protected by Auth, wait, Auth also uses DB (to fetch user or check session)?
      // Actually AuthGuard doesn't hit DB for JWT (only session). Let's see if AuthGuard passes.
      // If no token is provided, we get 401. Let's just mock db for something unauthenticated?
      // /feed requires auth. We can use a route that doesn't, e.g., POST /auth/login, which queries users.
      
      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/send-otp',
        payload: { email: 'test@srmist.edu.in' },
      });

      expect(loginRes.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(JSON.parse(loginRes.payload).code).toBe('SERVICE_UNAVAILABLE');

      // Restore
      // @ts-ignore
      db.select = originalSelect;
    });
  });

  describe('AppThrottlerGuard Resilience', () => {
    it('should fail-closed on security routes if Redis throws error', async () => {
      const { ThrottlerStorage } = require('@nestjs/throttler');
      const storage = app.get(ThrottlerStorage);
      const originalIncrement = storage.increment;
      
      storage.increment = jest.fn().mockRejectedValue(new Error('Redis connection lost'));

      const originalEnableRateLimit = process.env.TEST_ENABLE_RATE_LIMIT;
      process.env.TEST_ENABLE_RATE_LIMIT = 'true';
      
      // Security route: /auth/send-otp
      const resSecure = await app.inject({
        method: 'POST',
        url: '/auth/send-otp',
        payload: { email: 'test@srmist.edu.in' },
      });

      expect(resSecure.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);

      // General route: /feed (requires auth, so we just get 401, but the throttler should pass)
      // Actually, if throttler fails open, it passes the guard, then JwtAuthGuard kicks in and returns 401.
      const resGeneral = await app.inject({
        method: 'GET',
        url: '/feed',
      });
      
      expect(resGeneral.statusCode).toBe(HttpStatus.UNAUTHORIZED); // Guard allowed it through, Auth caught it

      // Restore
      storage.increment = originalIncrement;
      process.env.TEST_ENABLE_RATE_LIMIT = originalEnableRateLimit;
    });
  });
});
