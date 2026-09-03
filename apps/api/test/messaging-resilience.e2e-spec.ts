import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { db } from '../src/db';
import {
  messages,
  messageOutbox,
  users,
  profiles,
  connections,
  conversations,
  conversationParticipants,
} from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { MessageDeliveryWorkerService } from '../src/messaging/services/message-delivery-worker.service';
import fastifyCookie from '@fastify/cookie';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';
import { getE2eJwtSignOptions } from './test-utils';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

describe('Messaging Durability & Reconnect Resilience (e2e)', () => {
  let app: NestFastifyApplication;
  let workerService: MessageDeliveryWorkerService;
  let jwtService: JwtService;
  let redisClient: Redis;

  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let conversationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.register(fastifyCookie as any, {
      secret: process.env.COOKIE_SECRET || 'test-secret',
    });
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

    workerService = app.get(MessageDeliveryWorkerService);
    jwtService = app.get(JwtService);
    redisClient = app.get('REDIS_CLIENT');

    // 1. Create test users & profiles
    const [uA] = await db
      .insert(users)
      .values({ email: 'usera_resilience@srmist.edu.in', isVerified: true })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'userb_resilience@srmist.edu.in', isVerified: true })
      .returning();

    userA = uA;
    userB = uB;

    await db.insert(profiles).values([
      {
        userId: userA.id,
        username: 'usera_resilience',
        displayName: 'User A',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2021,
        graduationYear: 2025,
      },
      {
        userId: userB.id,
        username: 'userb_resilience',
        displayName: 'User B',
        campus: 'KTR',
        department: 'ECE',
        degreeProgram: 'B.Tech',
        batchYear: 2021,
        graduationYear: 2025,
      },
    ]);

    tokenA = jwtService.sign(
      { sub: userA.id, email: userA.email },
      getE2eJwtSignOptions(),
    );
    tokenB = jwtService.sign(
      { sub: userB.id, email: userB.email },
      getE2eJwtSignOptions(),
    );

    // 2. Mutual connection
    const [canonicalA, canonicalB] =
      userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];
    await db.insert(connections).values({
      userAId: canonicalA,
      userBId: canonicalB,
    });

    // 3. Conversation & participants
    const [convo] = await db
      .insert(conversations)
      .values({
        userAId: canonicalA,
        userBId: canonicalB,
      })
      .returning();

    conversationId = convo.id;

    await db.insert(conversationParticipants).values([
      { conversationId: convo.id, userId: userA.id },
      { conversationId: convo.id, userId: userB.id },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Durable Outbox & Redis Outage Survival', () => {
    it('should create and persist message when Redis publish throws error (201 Created)', async () => {
      const originalPublish = redisClient.publish;
      redisClient.publish = jest
        .fn()
        .mockRejectedValue(new Error('Redis connection down'));

      const res = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          content: 'Hello during Redis outage',
          messageType: 'TEXT',
        },
      });

      expect(res.statusCode).toBe(HttpStatus.CREATED);
      const body = JSON.parse(res.payload);
      expect(body.id).toBeDefined();
      expect(body.content).toBe('Hello during Redis outage');

      const [dbMsg] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, body.id));
      expect(dbMsg).toBeDefined();

      const outboxRows = await db
        .select()
        .from(messageOutbox)
        .where(eq(messageOutbox.messageId, body.id));

      expect(outboxRows.length).toBeGreaterThan(0);
      expect(outboxRows[0].status).toBe('PENDING');

      redisClient.publish = originalPublish;
    });

    it('should process pending outbox events once Redis is healthy', async () => {
      const pendingBefore = await db
        .select()
        .from(messageOutbox)
        .where(eq(messageOutbox.status, 'PENDING'));

      expect(pendingBefore.length).toBeGreaterThan(0);

      await workerService.processOutbox();

      const pendingAfter = await db
        .select()
        .from(messageOutbox)
        .where(eq(messageOutbox.status, 'PENDING'));

      expect(pendingAfter.length).toBe(0);
    });

    it('should reclaim stale PROCESSING outbox items after lease expiry', async () => {
      const [msg] = await db
        .insert(messages)
        .values({
          conversationId,
          senderId: userA.id,
          content: 'Stale lease test message',
          messageType: 'TEXT',
        })
        .returning();

      const staleTime = new Date(Date.now() - 6 * 60 * 1000);

      const [staleOutbox] = await db
        .insert(messageOutbox)
        .values({
          eventId: `stale_test_${msg.id}`,
          messageId: msg.id,
          conversationId,
          recipientId: userB.id,
          type: 'message:new',
          payload: msg,
          status: 'PROCESSING',
          claimedAt: staleTime,
          attempts: 1,
        })
        .returning();

      expect(staleOutbox.status).toBe('PROCESSING');

      await workerService.processOutbox();

      const [reclaimed] = await db
        .select()
        .from(messageOutbox)
        .where(eq(messageOutbox.id, staleOutbox.id));

      expect(reclaimed.status).toBe('PROCESSED');
    });
  });

  describe('Reconnect Recovery & Forward Cursor Sync', () => {
    it('should fetch missed messages chronologically using afterId cursor', async () => {
      // Clear previous messages in conversationId for isolated cursor sync test
      await db.delete(messageOutbox).where(eq(messageOutbox.conversationId, conversationId));
      await db.delete(messages).where(eq(messages.conversationId, conversationId));

      const res1 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'Message 1 (Offline Anchor)', messageType: 'TEXT' },
      });
      const msg1 = JSON.parse(res1.payload);

      await new Promise((r) => setTimeout(r, 15));

      const res2 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'Message 2 (Missed)', messageType: 'TEXT' },
      });
      const msg2 = JSON.parse(res2.payload);

      await new Promise((r) => setTimeout(r, 15));

      const res3 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { content: 'Message 3 (Missed)', messageType: 'TEXT' },
      });
      const msg3 = JSON.parse(res3.payload);

      const syncRes = await app.inject({
        method: 'GET',
        url: `/messages/conversations/${conversationId}/messages?afterId=${msg1.id}`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(syncRes.statusCode).toBe(HttpStatus.OK);
      const syncBody = JSON.parse(syncRes.payload);
      expect(syncBody.data.length).toBe(2);
      expect(syncBody.data[0].id).toBe(msg2.id);
      expect(syncBody.data[1].id).toBe(msg3.id);
    });
  });

  describe('Multi-Worker Concurrency Safety', () => {
    it('should safely process outbox concurrently without duplicate processing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'Concurrent Outbox Test', messageType: 'TEXT' },
      });
      const msg = JSON.parse(res.payload);

      await Promise.all([
        workerService.processOutbox(),
        workerService.processOutbox(),
      ]);

      const outboxRows = await db
        .select()
        .from(messageOutbox)
        .where(eq(messageOutbox.messageId, msg.id));

      expect(outboxRows.every((r) => r.status === 'PROCESSED')).toBe(true);
    });
  });
});
