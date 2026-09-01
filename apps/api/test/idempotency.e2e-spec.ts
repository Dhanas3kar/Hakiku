import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './../src/filters/global-exception.filter';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { db } from '../src/db';
import { users, profiles, connections, messages, posts } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Idempotency & Concurrency (e2e)', () => {
  let app: NestFastifyApplication;
  let tokenA: string;
  let tokenB: string;
  let conversationId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const fastifyAdapter = new FastifyAdapter();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(fastifyAdapter);

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

    // Insert test users — isVerified (no passwordHash; app uses OTP auth)
    const [uA] = await db
      .insert(users)
      .values({ email: 'testa_idem@srmist.edu.in', isVerified: true })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'testb_idem@srmist.edu.in', isVerified: true })
      .returning();

    userAId = uA.id;
    userBId = uB.id;

    // Insert profiles with all required NOT NULL fields
    await db.insert(profiles).values([
      {
        userId: userAId,
        username: 'testa_idem',
        displayName: 'Test A',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      },
      {
        userId: userBId,
        username: 'testb_idem',
        displayName: 'Test B',
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      },
    ]);

    // Connections table requires userAId < userBId (canonical_user_order constraint)
    const [canonicalA, canonicalB] = [userAId, userBId].sort();
    await db.insert(connections).values({ userAId: canonicalA, userBId: canonicalB });

    // Sign JWT tokens directly — same pattern as messaging.e2e-spec.ts
    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed',
    });
    tokenA = await jwtService.signAsync({ sub: uA.id, email: uA.email, role: uA.role });
    tokenB = await jwtService.signAsync({ sub: uB.id, email: uB.email, role: uB.role });

    // Create a conversation between A and B
    const convRes = await app.inject({
      method: 'POST',
      url: '/messages/conversations',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { targetUserId: userBId },
    });
    conversationId = JSON.parse(convRes.payload).id;
  });

  afterAll(async () => {
    // Cleanup — cascades to profiles and connections via FK
    await db.delete(users).where(eq(users.email, 'testa_idem@srmist.edu.in'));
    await db.delete(users).where(eq(users.email, 'testb_idem@srmist.edu.in'));
    await app.close();
  });

  describe('Messages Idempotency', () => {
    it('TEST 1 & 3: Sequential duplicate message request -> same logical result', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      const res1 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'Hello World', messageType: 'TEXT', idempotencyKey },
      });
      
      expect(res1.statusCode).toBe(201);
      const msg1 = JSON.parse(res1.payload);

      const res2 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'Hello World', messageType: 'TEXT', idempotencyKey },
      });
      
      expect(res2.statusCode).toBe(201);
      const msg2 = JSON.parse(res2.payload);

      expect(msg1.id).toEqual(msg2.id); // Same DB row returned
    });

    it('TEST 5: Two concurrent identical message requests -> one row', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      const payload = { content: 'Concurrent message', messageType: 'TEXT', idempotencyKey };
      const reqs = [
        app.inject({ method: 'POST', url: `/messages/conversations/${conversationId}/messages`, headers: { authorization: `Bearer ${tokenA}` }, payload }),
        app.inject({ method: 'POST', url: `/messages/conversations/${conversationId}/messages`, headers: { authorization: `Bearer ${tokenA}` }, payload }),
        app.inject({ method: 'POST', url: `/messages/conversations/${conversationId}/messages`, headers: { authorization: `Bearer ${tokenA}` }, payload }),
      ];

      const responses = await Promise.all(reqs);
      
      responses.forEach(res => {
        expect(res.statusCode).toBe(201); // All succeed
      });

      const messageIds = responses.map(res => JSON.parse(res.payload).id);
      
      // All IDs should be strictly equal
      expect(messageIds[0]).toEqual(messageIds[1]);
      expect(messageIds[1]).toEqual(messageIds[2]);
      
      // Verify DB count
      const dbMsgs = await db.select().from(messages).where(eq(messages.idempotencyKey, idempotencyKey));
      expect(dbMsgs.length).toBe(1);
    });

    it('TEST 7: Same key + different sender -> independent messages', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      const res1 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'I am A', messageType: 'TEXT', idempotencyKey },
      });

      const res2 = await app.inject({
        method: 'POST',
        url: `/messages/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { content: 'I am B', messageType: 'TEXT', idempotencyKey },
      });

      expect(res1.statusCode).toBe(201);
      expect(res2.statusCode).toBe(201);
      
      const msg1 = JSON.parse(res1.payload);
      const msg2 = JSON.parse(res2.payload);
      expect(msg1.id).not.toEqual(msg2.id); // Different rows
    });
  });

  describe('Posts Idempotency', () => {
    it('TEST 2 & 4: Sequential duplicate post request -> same logical result', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      const res1 = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'My new post', visibility: 'PUBLIC', idempotencyKey },
      });
      
      expect(res1.statusCode).toBe(201);
      const post1 = JSON.parse(res1.payload);

      const res2 = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'My new post', visibility: 'PUBLIC', idempotencyKey },
      });
      
      expect(res2.statusCode).toBe(201);
      const post2 = JSON.parse(res2.payload);

      expect(post1.id).toEqual(post2.id); // Same DB row
    });

    it('TEST 6: Two concurrent identical post requests -> one row', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      const payload = { content: 'Concurrent post', visibility: 'PUBLIC', idempotencyKey };
      const reqs = [
        app.inject({ method: 'POST', url: '/posts', headers: { authorization: `Bearer ${tokenB}` }, payload }),
        app.inject({ method: 'POST', url: '/posts', headers: { authorization: `Bearer ${tokenB}` }, payload }),
        app.inject({ method: 'POST', url: '/posts', headers: { authorization: `Bearer ${tokenB}` }, payload }),
      ];

      const responses = await Promise.all(reqs);
      
      responses.forEach(res => {
        expect(res.statusCode).toBe(201);
      });

      const postIds = responses.map(res => JSON.parse(res.payload).id);
      
      // All IDs should be strictly equal
      expect(postIds[0]).toEqual(postIds[1]);
      expect(postIds[1]).toEqual(postIds[2]);
      
      // Verify DB count
      const dbPosts = await db.select().from(posts).where(eq(posts.idempotencyKey, idempotencyKey));
      expect(dbPosts.length).toBe(1);
    });

    it('TEST 8: Same key + different author -> independent posts', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      const res1 = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'Post A', visibility: 'PUBLIC', idempotencyKey },
      });

      const res2 = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { content: 'Post B', visibility: 'PUBLIC', idempotencyKey },
      });

      expect(res1.statusCode).toBe(201);
      expect(res2.statusCode).toBe(201);
      
      const post1 = JSON.parse(res1.payload);
      const post2 = JSON.parse(res2.payload);
      expect(post1.id).not.toEqual(post2.id); // Different rows
    });
  });
});
