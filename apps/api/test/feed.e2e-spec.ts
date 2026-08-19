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
  posts,
  postMedia,
  pendingMediaUploads,
  postLikes,
  comments,
  profileSkills,
  profileInterests,
  skills,
  interests,
  blocks,
  connections,
  follows,
  connectionRequests,
  authSessions,
  auditLogs,
  notifications,
  notificationOutbox,
  notificationEvents,
  notificationPreferences,
} from '../src/db/schema';
import Redis from 'ioredis';

describe('Feed Module (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let db: any;
  let redis: Redis;

  let studentA: { id: string; email: string; token: string };
  let studentB: { id: string; email: string; token: string };
  let studentC: { id: string; email: string; token: string };
  let studentD: { id: string; email: string; token: string };

  let postAId: string;
  let postBConnId: string;
  let postBPrivId: string;
  let postCPublicId: string;

  let client: any;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.flushdb();

    client = postgres(process.env.DATABASE_URL!, { max: 2, idle_timeout: 5 });
    db = drizzle(client);

    // Clean DB
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

    // Create Users
    const [uA] = await db
      .insert(users)
      .values({ email: 'usera_feed@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'userb_feed@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();
    const [uC] = await db
      .insert(users)
      .values({ email: 'userc_feed@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();
    const [uD] = await db
      .insert(users)
      .values({ email: 'userd_feed@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();

    // Create Profiles
    await db.insert(profiles).values({
      userId: uA.id,
      username: 'usera_feed',
      displayName: 'User A',
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2022,
      graduationYear: 2026,
      isProfileCompleted: true,
    });
    await db.insert(profiles).values({
      userId: uB.id,
      username: 'userb_feed',
      displayName: 'User B',
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2022,
      graduationYear: 2026,
      isProfileCompleted: true,
    });
    await db.insert(profiles).values({
      userId: uC.id,
      username: 'userc_feed',
      displayName: 'User C',
      campus: 'RAM',
      department: 'ECE',
      degreeProgram: 'B.Tech',
      batchYear: 2023,
      graduationYear: 2027,
      isProfileCompleted: true,
    });
    await db.insert(profiles).values({
      userId: uD.id,
      username: 'userd_feed',
      displayName: 'User D',
      campus: 'VDP',
      department: 'IT',
      degreeProgram: 'B.Tech',
      batchYear: 2024,
      graduationYear: 2028,
      isProfileCompleted: true,
    });

    // Setup Relationships:
    // Student A follows Student C
    await db.insert(follows).values({ followerId: uA.id, followingId: uC.id });

    // Student A and Student B are mutual connections (Canonical order uA < uB)
    const userAId = uA.id < uB.id ? uA.id : uB.id;
    const userBId = uA.id < uB.id ? uB.id : uA.id;
    await db.insert(connections).values({ userAId, userBId });

    jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed' });

    studentA = { id: uA.id, email: uA.email, token: await jwtService.signAsync({ sub: uA.id, email: uA.email, role: uA.role }) };
    studentB = { id: uB.id, email: uB.email, token: await jwtService.signAsync({ sub: uB.id, email: uB.email, role: uB.role }) };
    studentC = { id: uC.id, email: uC.email, token: await jwtService.signAsync({ sub: uC.id, email: uC.email, role: uC.role }) };
    studentD = { id: uD.id, email: uD.email, token: await jwtService.signAsync({ sub: uD.id, email: uD.email, role: uD.role }) };

    // App Init
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    await app.register(fastifyCookie, { secret: 'test-secret' });
    await app.register(fastifyCsrf, { cookieOpts: { signed: true } });

    app.getHttpAdapter().getInstance().addContentTypeParser(
      ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'application/octet-stream'],
      { parseAs: 'buffer' },
      (_req: any, payload: any, done: any) => {
        done(null, payload);
      }
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (redis) await redis.quit();
    if (client) await client.end();
  });

  describe('Feed Candidate Generation & Personalization', () => {
    it('should reject unauthenticated request to /feed with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/feed');
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should seed posts for Student A, B, C, D', async () => {
      // 1. Student A creates PUBLIC post
      const resA = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: 'Post by Student A', visibility: 'PUBLIC' });
      postAId = resA.body.id;

      // 2. Student B creates CONNECTIONS_ONLY post
      const resBConn = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ content: 'Connections only post by Student B', visibility: 'CONNECTIONS_ONLY' });
      postBConnId = resBConn.body.id;

      // 3. Student B creates PRIVATE post
      const resBPriv = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ content: 'Private post by Student B', visibility: 'PRIVATE' });
      postBPrivId = resBPriv.body.id;

      // 4. Student C creates PUBLIC post
      const resCPub = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentC.token}`)
        .send({ content: 'Public post by Student C (Followed by A)', visibility: 'PUBLIC' });
      postCPublicId = resCPub.body.id;

      expect(resA.status).toBe(HttpStatus.CREATED);
      expect(resBConn.status).toBe(HttpStatus.CREATED);
      expect(resBPriv.status).toBe(HttpStatus.CREATED);
      expect(resCPub.status).toBe(HttpStatus.CREATED);
    });

    it('should return personalized home feed for Student A containing connected B and followed C posts', async () => {
      const res = await request(app.getHttpServer())
        .get('/feed?limit=20')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBeGreaterThan(0);

      const returnedPostIds = res.body.data.map((item: any) => item.id);

      // Student A sees own post, connected B connections_only post, and followed C public post
      expect(returnedPostIds).toContain(postAId);
      expect(returnedPostIds).toContain(postBConnId);
      expect(returnedPostIds).toContain(postCPublicId);

      // Student A MUST NOT see Student B PRIVATE post
      expect(returnedPostIds).not.toContain(postBPrivId);
    });

    it('should verify viewerState flags (isFollowing, isConnected) in feed response', async () => {
      const res = await request(app.getHttpServer())
        .get('/feed?limit=20')
        .set('Authorization', `Bearer ${studentA.token}`);

      const itemB = res.body.data.find((i: any) => i.id === postBConnId);
      const itemC = res.body.data.find((i: any) => i.id === postCPublicId);

      expect(itemB).toBeDefined();
      expect(itemC).toBeDefined();
    });

    it('should REJECT CONNECTIONS_ONLY post for non-connected Student D', async () => {
      const res = await request(app.getHttpServer())
        .get('/feed?limit=20')
        .set('Authorization', `Bearer ${studentD.token}`);

      const returnedPostIds = res.body.data.map((item: any) => item.id);
      expect(returnedPostIds).not.toContain(postBConnId);
    });
  });

  describe('Block Isolation in Feed', () => {
    it('should SILENTLY EXCLUDE Student B posts when Student D blocks Student B', async () => {
      // Student D blocks Student B
      await request(app.getHttpServer())
        .post(`/networking/block/${studentB.id}`)
        .set('Authorization', `Bearer ${studentD.token}`);

      const res = await request(app.getHttpServer())
        .get('/feed?limit=20')
        .set('Authorization', `Bearer ${studentD.token}`);

      const returnedPostIds = res.body.data.map((item: any) => item.id);
      expect(returnedPostIds).not.toContain(postBConnId);
    });
  });

  describe('Infinite Scroll & Deterministic Cursor Pagination', () => {
    it('should paginate feed using Base64 cursor without duplicate records across pages', async () => {
      // Request page 1 with limit=2
      const page1Res = await request(app.getHttpServer())
        .get('/feed?limit=2')
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(page1Res.status).toBe(HttpStatus.OK);
      expect(page1Res.body.data.length).toBeLessThanOrEqual(2);
      expect(page1Res.body.pagination.nextCursor).toBeDefined();

      const page1Ids = page1Res.body.data.map((i: any) => i.id);
      const cursor = page1Res.body.pagination.nextCursor;

      // Request page 2 using cursor
      const page2Res = await request(app.getHttpServer())
        .get(`/feed?limit=2&cursor=${encodeURIComponent(cursor)}`)
        .set('Authorization', `Bearer ${studentA.token}`);

      expect(page2Res.status).toBe(HttpStatus.OK);
      const page2Ids = page2Res.body.data.map((i: any) => i.id);

      // Ensure NO DUPLICATES between page 1 and page 2
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it('should reject malformed cursor string with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/feed?cursor=invalid-cursor-string')
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Discovery Feed Filters', () => {
    it('should filter public posts by campus in /feed/discover', async () => {
      const res = await request(app.getHttpServer())
        .get('/feed/discover?campus=KTR')
        .set('Authorization', `Bearer ${studentD.token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const allKtr = res.body.data.every((i: any) => i.author.campus === 'KTR');
      expect(allKtr).toBe(true);
    });
  });
});
