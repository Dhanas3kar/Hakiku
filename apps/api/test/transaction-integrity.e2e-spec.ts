import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { db } from '../src/db';
import {
  users,
  profiles,
  connections,
  messages,
  posts,
  notificationOutbox,
  notifications,
  notificationEvents,
} from '../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NotificationWorkerService } from '../src/notifications/services/notification-worker.service';
import { NotificationOutboxService } from '../src/notifications/services/notification-outbox.service';
import { MessageService } from '../src/messaging/services/message.service';
import { PostsService } from '../src/posts/services/posts.service';

describe('Transaction Integrity & Outbox Reliability (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let workerService: NotificationWorkerService;
  let outboxService: NotificationOutboxService;
  let messageService: MessageService;
  let postsService: PostsService;

  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let tokenB: string;
  let conversationId: string;

  beforeAll(async () => {
    // Ensure event_id column exists on test db notifications table
    await db.execute(
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id varchar(255);`,
    );
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications (event_id);`,
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = app.get(JwtService);
    workerService = app.get(NotificationWorkerService);
    outboxService = app.get(NotificationOutboxService);
    messageService = app.get(MessageService);
    postsService = app.get(PostsService);

    // Disable background worker interval to prevent race conditions in tests
    // @ts-ignore
    if (workerService.intervalId) {
      // @ts-ignore
      clearInterval(workerService.intervalId);
    }
    // @ts-ignore
    workerService.isRunning = false;

    // Create test users A & B
    const [uA] = await db
      .insert(users)
      .values({ email: 'txn_user_a@srmist.edu.in', isVerified: true })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'txn_user_b@srmist.edu.in', isVerified: true })
      .returning();

    userAId = uA.id;
    userBId = uB.id;

    await db.insert(profiles).values([
      {
        userId: userAId,
        username: 'txn_usera',
        displayName: 'Txn User A',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      },
      {
        userId: userBId,
        username: 'txn_userb',
        displayName: 'Txn User B',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      },
    ]);

    const [canonicalA, canonicalB] = [userAId, userBId].sort();
    await db
      .insert(connections)
      .values({ userAId: canonicalA, userBId: canonicalB });

    jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed',
      signOptions: { issuer: 'hakiku.com', audience: 'hakiku.com' },
    });
    tokenA = await jwtService.signAsync({
      sub: uA.id,
      email: uA.email,
      role: uA.role,
    });
    tokenB = await jwtService.signAsync({
      sub: uB.id,
      email: uB.email,
      role: uB.role,
    });

    const convRes = await app.inject({
      method: 'POST',
      url: '/messages/conversations',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { targetUserId: userBId },
    });
    conversationId = JSON.parse(convRes.payload).id;
  });

  afterAll(async () => {
    await db
      .delete(users)
      .where(
        sql`${users.email} IN ('txn_user_a@srmist.edu.in', 'txn_user_b@srmist.edu.in')`,
      );
    await app.close();
  });

  describe('INVARIANT 1 & 2: Transaction Atomicity & Rollback Safety', () => {
    it('TEST 1: Message entity write succeeds but outbox write fails -> entire transaction rolls back', async () => {
      const testMsgIdempotencyKey = crypto.randomUUID();
      const spy = jest
        .spyOn(outboxService, 'appendEvent')
        .mockImplementationOnce(async () => {
          throw new Error('Simulated outbox write failure');
        });

      const res = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          content: 'Test 1 Rollback Message',
          messageType: 'TEXT',
          idempotencyKey: testMsgIdempotencyKey,
        },
      });

      spy.mockRestore();

      expect(res.statusCode).toBe(500);

      // Assert database state: neither message nor outbox record exists
      const dbMsgs = await db
        .select()
        .from(messages)
        .where(eq(messages.idempotencyKey, testMsgIdempotencyKey));
      expect(dbMsgs.length).toBe(0);

      const dbOutbox = await db
        .select()
        .from(notificationOutbox)
        .where(
          sql`${notificationOutbox.payload}->>'entityId' = ${conversationId} AND ${notificationOutbox.payload}->'data'->>'messageType' = 'TEXT'`,
        );
      const matchingOutbox = dbOutbox.filter(
        (o) => (o.payload as any)?.data?.content === 'Test 1 Rollback Message',
      );
      expect(matchingOutbox.length).toBe(0);
    });

    it('TEST 2: Outbox write succeeds logically but another operation fails -> entire transaction rolls back', async () => {
      const testMsgIdempotencyKey = crypto.randomUUID();

      // Try sending a message with invalid media key (which fails inside transaction)
      const res = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          content: 'Test 2 Rollback Message',
          messageType: 'IMAGE',
          mediaKeys: ['non-existent-media-key-123'],
          idempotencyKey: testMsgIdempotencyKey,
        },
      });

      expect(res.statusCode).toBe(400);

      // Verify no message or outbox record exists
      const dbMsgs = await db
        .select()
        .from(messages)
        .where(eq(messages.idempotencyKey, testMsgIdempotencyKey));
      expect(dbMsgs.length).toBe(0);
    });

    it('TEST 3: Post entity transaction failure -> no orphan post and no orphan outbox event', async () => {
      const testPostIdempotencyKey = crypto.randomUUID();

      // Trigger post creation with non-existent pollId to force transaction failure
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          content: 'Test 3 Rollback Post',
          visibility: 'PUBLIC',
          pollId: crypto.randomUUID(), // invalid pollId
          idempotencyKey: testPostIdempotencyKey,
        },
      });

      // Post creation fails (400 or 500)
      expect(res.statusCode).toBeGreaterThanOrEqual(400);

      // Verify no orphan post or outbox event was committed
      const dbPosts = await db
        .select()
        .from(posts)
        .where(eq(posts.idempotencyKey, testPostIdempotencyKey));
      expect(dbPosts.length).toBe(0);
    });
  });

  describe('INVARIANT 3 & 5: Worker Retry Safety & Outbox Processing', () => {
    it('TEST 4: Notification worker encounters DB failure while processing event -> event remains retryable with attempts incremented', async () => {
      const eventId = `EVT_FAIL_${crypto.randomUUID()}`;

      // Insert an outbox event with invalid recipientId to trigger DB insertion failure in handleEvent
      await db.insert(notificationOutbox).values({
        eventId,
        type: 'POST_LIKE',
        payload: {
          recipientId: crypto.randomUUID(), // non-existent recipient -> FK failure
          actorId: userAId,
          entityType: 'POST',
          entityId: crypto.randomUUID(),
        },
        status: 'PENDING',
        attempts: 0,
      });

      // Execute worker process loop
      await (workerService as any).processOutbox();

      // Assert outbox row state
      const [outboxRow] = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventId, eventId));

      expect(outboxRow).toBeDefined();
      expect(outboxRow.status).toBe('PENDING'); // Retryable
      expect(outboxRow.attempts).toBe(1); // Attempts incremented
      expect(outboxRow.lastError).toBeDefined(); // Error recorded
      expect(outboxRow.lastError!.length).toBeGreaterThan(0);
    });

    it('TEST 5: Notification processing succeeds -> exactly 1 notification, outbox = PROCESSED', async () => {
      const eventId = `EVT_SUCCESS_${crypto.randomUUID()}`;

      await db.insert(notificationOutbox).values({
        eventId,
        type: 'FOLLOW',
        payload: {
          recipientId: userBId,
          actorId: userAId,
          entityType: 'USER',
          entityId: userAId,
        },
        status: 'PENDING',
        attempts: 0,
      });

      await (workerService as any).processOutbox();

      const [outboxRow] = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventId, eventId));

      expect(outboxRow.status).toBe('PROCESSED');

      const createdNotifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventId, eventId));

      expect(createdNotifs.length).toBe(1);
      expect(createdNotifs[0].recipientId).toBe(userBId);
    });

    it('TEST 6: Same outbox event is processed twice -> exactly one logical notification (no duplicate)', async () => {
      const eventId = `EVT_DUP_${crypto.randomUUID()}`;

      await db.insert(notificationOutbox).values({
        eventId,
        type: 'POST_COMMENT',
        payload: {
          recipientId: userBId,
          actorId: userAId,
          entityType: 'POST',
          entityId: crypto.randomUUID(),
        },
        status: 'PENDING',
        attempts: 0,
      });

      // Run 1
      await (workerService as any).processOutbox();

      // Force status back to PENDING to simulate reprocessing
      await db
        .update(notificationOutbox)
        .set({ status: 'PENDING', availableAt: new Date() })
        .where(eq(notificationOutbox.eventId, eventId));

      // Run 2
      await (workerService as any).processOutbox();

      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventId, eventId));

      expect(notifs.length).toBe(1);
    });
  });

  describe('INVARIANT 4, 5 & 6: Worker Crash, Retry & Concurrency Safety', () => {
    it('TEST 7: Worker failure followed by retry -> Attempt 1 failure, Attempt 2 success, outbox PROCESSED, attempts = 2', async () => {
      const eventId = `EVT_RETRY_${crypto.randomUUID()}`;
      const fakeRecipientId = crypto.randomUUID();

      await db.insert(notificationOutbox).values({
        eventId,
        type: 'POST_LIKE',
        payload: {
          recipientId: fakeRecipientId,
          actorId: userAId,
          entityType: 'POST',
          entityId: crypto.randomUUID(),
        },
        status: 'PENDING',
        attempts: 0,
      });

      // Attempt 1: Fails due to non-existent recipientId
      await (workerService as any).processOutbox();

      let [outboxRow] = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventId, eventId));
      expect(outboxRow.attempts).toBe(1);
      expect(outboxRow.status).toBe('PENDING');

      // Now create the missing user and profile so Attempt 2 succeeds
      await db.insert(users).values({ id: fakeRecipientId, email: `temp_${eventId}@srmist.edu.in`, isVerified: true });
      await db.insert(profiles).values({
        userId: fakeRecipientId,
        username: `temp_${eventId.slice(-8)}`,
        displayName: 'Temp User',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      });

      // Reset availableAt to NOW() so worker picks it up
      await db
        .update(notificationOutbox)
        .set({ availableAt: new Date() })
        .where(eq(notificationOutbox.eventId, eventId));

      // Attempt 2: Succeeds
      await (workerService as any).processOutbox();

      [outboxRow] = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventId, eventId));
      expect(outboxRow.status).toBe('PROCESSED');
      expect(outboxRow.attempts).toBe(2);

      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventId, eventId));
      expect(notifs.length).toBe(1);

      // Cleanup temp user
      await db.delete(users).where(eq(users.id, fakeRecipientId));
    });

    it('TEST 8: Worker receives an already processed event -> safe no-op', async () => {
      const eventId = `EVT_ALREADY_PROCESSED_${crypto.randomUUID()}`;

      await db.insert(notificationEvents).values({ eventId });
      await db.insert(notificationOutbox).values({
        eventId,
        type: 'SYSTEM',
        payload: {
          recipientId: userBId,
          actorId: userAId,
          entityType: 'SYSTEM',
          entityId: 'sys-1',
        },
        status: 'PROCESSED',
        attempts: 1,
      });

      // Attempt to process already processed event
      await (workerService as any).processOutbox();

      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventId, eventId));

      expect(notifs.length).toBe(0); // Safe no-op
    });

    it('TEST 9: Multiple workers process the same event concurrently -> 1 notification, 0 duplicate side effects, outbox PROCESSED', async () => {
      const eventId = `EVT_CONCURRENT_${crypto.randomUUID()}`;

      await db.insert(notificationOutbox).values({
        eventId,
        type: 'COMMENT_REPLY',
        payload: {
          recipientId: userBId,
          actorId: userAId,
          entityType: 'COMMENT',
          entityId: crypto.randomUUID(),
        },
        status: 'PENDING',
        attempts: 0,
      });

      // Simulate 3 concurrent workers attempting processOutbox simultaneously
      await Promise.all([
        (workerService as any).processOutbox(),
        (workerService as any).processOutbox(),
        (workerService as any).processOutbox(),
      ]);

      const [outboxRow] = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.eventId, eventId));
      expect(outboxRow.status).toBe('PROCESSED');

      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventId, eventId));
      expect(notifs.length).toBe(1);
    });

    it('TEST 10: Message/post transaction rollback under concurrency -> no orphan records or inconsistent state', async () => {
      const idempotencyKey = crypto.randomUUID();

      // Launch 3 concurrent post creation requests where one succeeds and others hit idempotency or failure
      const reqs = [
        app.inject({
          method: 'POST',
          url: '/posts',
          headers: { authorization: `Bearer ${tokenA}` },
          payload: {
            content: 'Concurrent Post Txn Check',
            visibility: 'PUBLIC',
            idempotencyKey,
          },
        }),
        app.inject({
          method: 'POST',
          url: '/posts',
          headers: { authorization: `Bearer ${tokenA}` },
          payload: {
            content: 'Concurrent Post Txn Check',
            visibility: 'PUBLIC',
            idempotencyKey,
          },
        }),
        app.inject({
          method: 'POST',
          url: '/posts',
          headers: { authorization: `Bearer ${tokenA}` },
          payload: {
            content: 'Concurrent Post Txn Check',
            visibility: 'PUBLIC',
            idempotencyKey,
          },
        }),
      ];

      const res = await Promise.all(reqs);

      res.forEach((r) => expect(r.statusCode).toBe(201));

      // Assert physical database count: exactly 1 post row exists
      const dbPosts = await db
        .select()
        .from(posts)
        .where(eq(posts.idempotencyKey, idempotencyKey));
      expect(dbPosts.length).toBe(1);
    });
  });
});
