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
import {
  users,
  profiles,
  skills,
  interests,
  profileSkills,
  profileInterests,
  posts,
  postMedia,
  pendingMediaUploads,
  postLikes,
  comments,
  connectionRequests,
  connections,
  follows,
  blocks,
  authSessions,
  auditLogs,
  notifications,
  notificationOutbox,
  notificationEvents,
  notificationPreferences,
} from '../src/db/schema';
import Redis from 'ioredis';

describe('Networking Module (e2e)', () => {
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

    // Clean tables in reverse dependency order
    await db.delete(comments);
    await db.delete(postLikes);
    await db.delete(postMedia);
    await db.delete(pendingMediaUploads);
    await db.delete(posts);
    await db.delete(profileSkills);
    await db.delete(profileInterests);
    await db.delete(skills);
    await db.delete(interests);
    await db.delete(profiles);
    await db.delete(blocks);
    await db.delete(connectionRequests);
    await db.delete(connections);
    await db.delete(follows);
    await db.delete(authSessions);
    await db.delete(auditLogs);
    await db.delete(notifications);
    await db.delete(notificationOutbox);
    await db.delete(notificationEvents);
    await db.delete(notificationPreferences);
    await db.delete(users);

    // 3. Insert Test Users
    const [uA] = await db
      .insert(users)
      .values({ email: 'usera_net@srmist.edu.in', isVerified: true })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'userb_net@srmist.edu.in', isVerified: true })
      .returning();
    const [uC] = await db
      .insert(users)
      .values({ email: 'userc_net@srmist.edu.in', isVerified: true })
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

    // 4. Initialize Nest Application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    await app.register(fastifyCookie, { secret: 'test-secret' });
    await app.register(fastifyCsrf, { cookieOpts: { signed: true } });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await client.end();
  });

  describe('Self-Action Restrictors', () => {
    it('should reject self-follow with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/follow/${userA.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject self-connection-request with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/connections/request/${userA.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject self-block with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/block/${userA.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Follow / Unfollow & Pagination Flow', () => {
    it('should allow User A to follow User B', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/follow/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.message).toContain('followed successfully');
    });

    it('should reject duplicate follow with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/follow/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.CONFLICT);
    });

    it('should return User A in User B followers list (Paginated)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/networking/followers/${userB.id}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].followerId).toBe(userA.id);
    });

    it('should return User B in User A following list (Paginated)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/networking/following/${userA.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].followingId).toBe(userB.id);
    });

    it('should allow User A to unfollow User B', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/networking/follow/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  describe('Mutual Connection Requests & Auto-Acceptance Flow', () => {
    it('should allow User A to send a connection request to User B', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/connections/request/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.status).toBe('PENDING');
    });

    it('should return pending incoming request for User B', async () => {
      const res = await request(app.getHttpServer())
        .get('/networking/connections/requests/pending')
        .set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].senderId).toBe(userA.id);
    });

    it('should allow User B to accept User A connection request', async () => {
      // Get pending request ID
      const reqList = await request(app.getHttpServer())
        .get('/networking/connections/requests/pending')
        .set('Authorization', `Bearer ${userB.token}`);
      const requestId = reqList.body.data[0].requestId;

      const acceptRes = await request(app.getHttpServer())
        .post(`/networking/connections/accept/${requestId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(acceptRes.status).toBe(HttpStatus.OK);
    });

    it('should verify relationship status is CONNECTED (Messaging Precondition)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/networking/status/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.connectionStatus).toBe('CONNECTED');
    });

    it('should allow User A to remove connection with User B', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/networking/connections/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('should AUTO-ACCEPT when User C requests User A while User A has a pending request to User C', async () => {
      // 1. User A requests User C
      const req1 = await request(app.getHttpServer())
        .post(`/networking/connections/request/${userC.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(req1.body.status).toBe('PENDING');

      // 2. User C requests User A -> Auto Accept!
      const req2 = await request(app.getHttpServer())
        .post(`/networking/connections/request/${userA.id}`)
        .set('Authorization', `Bearer ${userC.token}`);
      expect(req2.status).toBe(HttpStatus.OK);
      expect(req2.body.autoAccepted).toBe(true);
      expect(req2.body.status).toBe('ACCEPTED');

      // 3. Verify status is CONNECTED
      const statusRes = await request(app.getHttpServer())
        .get(`/networking/status/${userC.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(statusRes.body.connectionStatus).toBe('CONNECTED');

      // Clean up connection
      await request(app.getHttpServer())
        .delete(`/networking/connections/${userC.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
    });
  });

  describe('Block Privacy & Cascade Overrides', () => {
    beforeAll(async () => {
      // Re-establish follow & connection between A and B
      await request(app.getHttpServer())
        .post(`/networking/follow/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      const connReq = await request(app.getHttpServer())
        .post(`/networking/connections/request/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);

      const pendingList = await request(app.getHttpServer())
        .get('/networking/connections/requests/pending')
        .set('Authorization', `Bearer ${userB.token}`);
      const reqId = pendingList.body.data[0].requestId;

      await request(app.getHttpServer())
        .post(`/networking/connections/accept/${reqId}`)
        .set('Authorization', `Bearer ${userB.token}`);
    });

    it('should allow User B to block User A (Cascade deletes follows & connection)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/block/${userA.id}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(HttpStatus.OK);

      // Verify connection was hard deleted
      const statusCheck = await db.select().from(connections);
      expect(statusCheck.length).toBe(0);
    });

    it('should ENFORCE BLOCK PRIVACY: User A probing User B status returns 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .get(`/networking/status/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should ENFORCE BLOCK PRIVACY: User A following User B returns 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/follow/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should ENFORCE BLOCK PRIVACY: User A requesting connection with User B returns 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .post(`/networking/connections/request/${userB.id}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should allow User B to unblock User A', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/networking/block/${userA.id}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(res.status).toBe(HttpStatus.OK);
    });
  });
});
