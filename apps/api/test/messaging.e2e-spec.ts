import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { JwtService } from '@nestjs/jwt';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import {
  users,
  profiles,
  connections,
  blocks,
  conversations,
  conversationParticipants,
  messages,
  messageMedia,
  messageReadReceipts
} from '../src/db/schema';
import Redis from 'ioredis';

describe('Messaging Module (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let db: any;
  let redis: Redis;
  let client: any;

  let userA: { id: string; email: string; token: string };
  let userB: { id: string; email: string; token: string };
  let userC: { id: string; email: string; token: string };

  beforeAll(async () => {
    // 1. Initialize Redis & Flush DB
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.flushdb();

    // 2. Initialize Postgres client
    client = postgres(process.env.DATABASE_URL!, { max: 2, idle_timeout: 5 });
    db = drizzle(client);

    // Clean tables
    await db.delete(messageReadReceipts);
    await db.delete(messageMedia);
    await db.delete(messages);
    await db.delete(conversationParticipants);
    await db.delete(conversations);
    await db.delete(blocks);
    await db.delete(connections);
    await db.delete(profiles);
    await db.delete(users);

    // 3. Insert Test Users
    const [uA] = await db
      .insert(users)
      .values({ email: 'usera_msg@srmist.edu.in', isVerified: true })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'userb_msg@srmist.edu.in', isVerified: true })
      .returning();
    const [uC] = await db
      .insert(users)
      .values({ email: 'userc_msg@srmist.edu.in', isVerified: true })
      .returning();

    jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed' });

    userA = {
      id: uA.id,
      email: uA.email,
      token: await jwtService.signAsync({ sub: uA.id, email: uA.email, role: uA.role }),
    };
    userB = {
      id: uB.id,
      email: uB.email,
      token: await jwtService.signAsync({ sub: uB.id, email: uB.email, role: uB.role }),
    };
    userC = {
      id: uC.id,
      email: uC.email,
      token: await jwtService.signAsync({ sub: uC.id, email: uC.email, role: uC.role }),
    };

    // Profiles
    await db.insert(profiles).values([
      { userId: uA.id, username: 'usera_msg', displayName: 'User A', campus: 'KTR', department: 'CSE', degreeProgram: 'B.Tech', batchYear: 2020, graduationYear: 2024 },
      { userId: uB.id, username: 'userb_msg', displayName: 'User B', campus: 'KTR', department: 'CSE', degreeProgram: 'B.Tech', batchYear: 2020, graduationYear: 2024 },
      { userId: uC.id, username: 'userc_msg', displayName: 'User C', campus: 'KTR', department: 'CSE', degreeProgram: 'B.Tech', batchYear: 2020, graduationYear: 2024 }
    ]);

    // Connections: A <-> B connected. C is unconnected.
    const [idA, idB] = [uA.id, uB.id].sort();
    await db.insert(connections).values({
      userAId: idA,
      userBId: idB,
    });

    // 4. Initialize NestJS App
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    
    // Setup matching auth.e2e-spec.ts
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET || 'cookie-secret' });
    await app.register(fastifyCsrf, { cookieOpts: { signed: true } });
    
    app.enableCors({ origin: true, credentials: true });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await client.end();
  });

  describe('Messaging Access & Creation', () => {
    it('should reject messaging between unconnected users (A -> C)', async () => {
      const response = await request(app.getHttpServer())
        .post('/messages/conversations')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          targetUserId: userC.id
        });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow conversation creation and messaging between connected users (A -> B)', async () => {
      const convRes = await request(app.getHttpServer())
        .post('/messages/conversations')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          targetUserId: userB.id
        });
      
      expect(convRes.status).toBe(HttpStatus.CREATED);
      const conversationId = convRes.body.id;

      const msgRes = await request(app.getHttpServer())
        .post(`/messages/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          content: 'Hello B',
          messageType: 'TEXT'
        });

      expect(msgRes.status).toBe(HttpStatus.CREATED);
      expect(msgRes.body).toHaveProperty('id');
      expect(msgRes.body).toHaveProperty('conversationId');
      expect(msgRes.body.content).toBe('Hello B');
    });

    it('should reject messaging if blocked (A blocks B)', async () => {
      // A blocks B
      await db.insert(blocks).values({
        blockerId: userA.id,
        blockedId: userB.id,
      });

      // B tries to message A
      const response = await request(app.getHttpServer())
        .post('/messages/conversations')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({
          targetUserId: userA.id
        });

      expect(response.status).toBe(HttpStatus.NOT_FOUND); // Generic 404 for blocked

      // Cleanup block
      await db.delete(blocks).where(eq(blocks.blockerId, userA.id));
    });
  });

  describe('Conversation Retrieval', () => {
    it('should list conversations for user A', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages/conversations')
        .set('Authorization', `Bearer ${userA.token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0]).toHaveProperty('targetUser');
      expect(response.body.items[0].targetUser.id).toBe(userB.id);
    });
  });
});
