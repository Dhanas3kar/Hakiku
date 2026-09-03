import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { db } from '../src/db';
import {
  users,
  profiles,
  posts,
  postLikes,
  connections,
  conversations,
  conversationParticipants,
  messages,
  messageOutbox,
} from '../src/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { Redis } from 'ioredis';

describe('Performance, Capacity & Production Validation (E2E)', () => {
  jest.setTimeout(60000);

  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let redisClient: Redis;

  let targetUserId: string;
  let targetPostId: string;
  let targetConvId: string;
  let userIds: string[] = [];
  let userTokens: string[] = [];

  const jwtIssuer = process.env.JWT_ISSUER || 'hakiku-api';
  const jwtAudience = process.env.JWT_AUDIENCE || 'hakiku-app';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyCookie as any, { secret: 'test-secret' });
    await app.register(fastifyCsrf as any, { cookieOpts: { signed: true } });

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
    redisClient = app.get('REDIS_CLIENT');

    // Create target user with unique tag
    const uniqueTag = crypto.randomUUID().slice(-8);
    const [tUser] = await db
      .insert(users)
      .values({ email: `perf_target_${uniqueTag}@srmist.edu.in`, isVerified: true })
      .returning();
    targetUserId = tUser.id;

    await db.insert(profiles).values({
      userId: targetUserId,
      username: `perf_target_usr_${uniqueTag}`,
      displayName: 'Perf Target User',
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2020,
      graduationYear: 2024,
    });

    // Create target post
    const [tPost] = await db
      .insert(posts)
      .values({
        authorId: targetUserId,
        content: 'Performance Target Post',
        visibility: 'PUBLIC',
      })
      .returning();
    targetPostId = tPost.id;

    // Create 100 stress users
    const userValues = [];
    const profileValues = [];

    for (let i = 0; i < 100; i++) {
      const id = crypto.randomUUID();
      userIds.push(id);
      const email = `perf_usr_${i}_${id.slice(-6)}@srmist.edu.in`;

      userValues.push({ id, email, isVerified: true });
      profileValues.push({
        userId: id,
        username: `perf_usr_${i}_${id.slice(-6)}`,
        displayName: `Perf User ${i}`,
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      });

      const token = await jwtService.signAsync(
        { sub: id, email, role: 'STUDENT' },
        { issuer: jwtIssuer, audience: jwtAudience },
      );
      userTokens.push(token);
    }

    await db.insert(users).values(userValues);
    await db.insert(profiles).values(profileValues);

    // Create conversation between target user and user 0
    const user0 = userIds[0];
    const [uA, uB] = targetUserId < user0 ? [targetUserId, user0] : [user0, targetUserId];

    await db.insert(connections).values({ userAId: uA, userBId: uB }).onConflictDoNothing();
    const [conv] = await db
      .insert(conversations)
      .values({ userAId: uA, userBId: uB })
      .onConflictDoNothing()
      .returning();

    targetConvId = conv?.id || (await db.select().from(conversations).where(sql`user_a_id = ${uA} AND user_b_id = ${uB}`).limit(1))[0].id;
    await db.insert(conversationParticipants).values([
      { conversationId: targetConvId, userId: targetUserId },
      { conversationId: targetConvId, userId: user0 },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, [...userIds, targetUserId]));
    }
    await app.close();
  });

  describe('1. 100 Concurrent Post Likes Performance & Durability', () => {
    it('100 concurrent users liking the same post -> 100 likes created, 0 error rate', async () => {
      const start = process.hrtime.bigint();
      const requests = userTokens.map((token) =>
        app.inject({
          method: 'POST',
          url: `/posts/${targetPostId}/like`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );

      const responses = await Promise.all(requests);
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      responses.forEach((res) => {
        expect(res.statusCode).toBe(HttpStatus.OK);
      });

      const dbLikes = await db
        .select()
        .from(postLikes)
        .where(eq(postLikes.postId, targetPostId));

      expect(dbLikes.length).toBe(100);
      expect(durationMs).toBeLessThan(10000);
    });
  });

  describe('2. 100 Concurrent Durable Message Sends & Outbox Integrity', () => {
    it('100 concurrent message sends -> 100 messages + 100 outbox items committed atomically', async () => {
      const user0Token = userTokens[0];
      const start = process.hrtime.bigint();

      const requests = Array.from({ length: 100 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: `/messages/conversations/${targetConvId}/messages`,
          headers: { authorization: `Bearer ${user0Token}` },
          payload: { content: `Concurrent perf message ${i}`, messageType: 'TEXT' },
        }),
      );

      const responses = await Promise.all(requests);
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      responses.forEach((res) => {
        expect(res.statusCode).toBe(HttpStatus.CREATED);
      });

      const dbMsgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, targetConvId));

      expect(dbMsgs.length).toBeGreaterThanOrEqual(100);

      const outboxRows = await db
        .select()
        .from(messageOutbox)
        .where(eq(messageOutbox.conversationId, targetConvId));

      expect(outboxRows.length).toBeGreaterThanOrEqual(100);
      expect(durationMs).toBeLessThan(10000);
    });
  });

  describe('3. Cursor Catch-Up Forward Sync Performance', () => {
    it('should query message history using afterId cursor with microsecond accuracy and low latency', async () => {
      const user0Token = userTokens[0];
      const [anchorMsg] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, targetConvId))
        .orderBy(messages.createdAt)
        .limit(1);

      const start = process.hrtime.bigint();
      const res = await app.inject({
        method: 'GET',
        url: `/messages/conversations/${targetConvId}/messages?afterId=${anchorMsg.id}`,
        headers: { authorization: `Bearer ${user0Token}` },
      });
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      expect(res.statusCode).toBe(HttpStatus.OK);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body.data)).toBe(true);
      expect(durationMs).toBeLessThan(500);
    });
  });

  describe('4. Transient Redis Outage Resilience Under Load', () => {
    it('should complete PostgreSQL transaction outbox inserts successfully during transient Redis issues', async () => {
      const user0Token = userTokens[0];

      // Simulate transient Redis disconnect
      const origPublish = redisClient.publish;
      redisClient.publish = (async () => {
        throw new Error('Simulated transient Redis failure under load');
      }) as any;

      try {
        const res = await app.inject({
          method: 'POST',
          url: `/messages/conversations/${targetConvId}/messages`,
          headers: { authorization: `Bearer ${user0Token}` },
          payload: { content: 'Message sent during Redis outage', messageType: 'TEXT' },
        });

        expect(res.statusCode).toBe(HttpStatus.CREATED);
        const createdMsg = JSON.parse(res.payload);

        // Verify PostgreSQL transaction committed message and outbox row
        const [savedMsg] = await db
          .select()
          .from(messages)
          .where(eq(messages.id, createdMsg.id));
        expect(savedMsg).toBeDefined();

        const [savedOutbox] = await db
          .select()
          .from(messageOutbox)
          .where(eq(messageOutbox.messageId, createdMsg.id));
        expect(savedOutbox).toBeDefined();
        expect(savedOutbox.status).toBe('PENDING');
      } finally {
        redisClient.publish = origPublish;
      }
    });
  });
});
