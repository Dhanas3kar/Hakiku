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

describe('Posts Module (e2e)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let redis: Redis;
  let client: any;
  let jwtService: JwtService;

  let studentA: { id: string; email: string; token: string };
  let studentB: { id: string; email: string; token: string };
  let studentC: { id: string; email: string; token: string };
  let suspendedD: { id: string; email: string; token: string };
  let bannedE: { id: string; email: string; token: string };

  let postAId: string;
  let postConnId: string;
  let uploadIdA: string;
  let commentIdC: string;

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
      .values({ email: 'usera_posts@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({ email: 'userb_posts@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();
    const [uC] = await db
      .insert(users)
      .values({ email: 'userc_posts@srmist.edu.in', isVerified: true, status: 'ACTIVE', role: 'STUDENT' })
      .returning();
    const [uD] = await db
      .insert(users)
      .values({ email: 'userd_suspended@srmist.edu.in', isVerified: true, status: 'SUSPENDED', role: 'STUDENT' })
      .returning();
    const [uE] = await db
      .insert(users)
      .values({ email: 'usere_banned@srmist.edu.in', isVerified: true, status: 'BANNED', role: 'STUDENT' })
      .returning();

    // Create Profiles
    await db.insert(profiles).values({
      userId: uA.id,
      username: 'usera_posts',
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
      username: 'userb_posts',
      displayName: 'User B',
      campus: 'KTR',
      department: 'ECE',
      degreeProgram: 'B.Tech',
      batchYear: 2022,
      graduationYear: 2026,
      isProfileCompleted: true,
    });
    await db.insert(profiles).values({
      userId: uC.id,
      username: 'userc_posts',
      displayName: 'User C',
      campus: 'RAM',
      department: 'IT',
      degreeProgram: 'B.Tech',
      batchYear: 2023,
      graduationYear: 2027,
      isProfileCompleted: true,
    });

    // Create Mutual Connection between A and B (Canonical userA < userB)
    const userAId = uA.id < uB.id ? uA.id : uB.id;
    const userBId = uA.id < uB.id ? uB.id : uA.id;
    await db.insert(connections).values({ userAId, userBId });

    jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed' });

    studentA = { id: uA.id, email: uA.email, token: await jwtService.signAsync({ sub: uA.id, email: uA.email, role: uA.role }) };
    studentB = { id: uB.id, email: uB.email, token: await jwtService.signAsync({ sub: uB.id, email: uB.email, role: uB.role }) };
    studentC = { id: uC.id, email: uC.email, token: await jwtService.signAsync({ sub: uC.id, email: uC.email, role: uC.role }) };
    suspendedD = { id: uD.id, email: uD.email, token: await jwtService.signAsync({ sub: uD.id, email: uD.email, role: uD.role }) };
    bannedE = { id: uE.id, email: uE.email, token: await jwtService.signAsync({ sub: uE.id, email: uE.email, role: uE.role }) };

    // App init
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
    await app.close();
    await redis.quit();
    await client.end();
  });

  describe('Post Creation & Media Ownership Validation', () => {
    it('should reject empty post creation (no text content and no media) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: '   ', mediaUploadIds: [] });
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject post creation by suspended account with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${suspendedD.token}`)
        .send({ content: 'Hello world' });
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should create a valid text-only post for Student A', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: 'First public announcement from Student A', visibility: 'PUBLIC' });
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.content).toBe('First public announcement from Student A');
      expect(res.body.visibility).toBe('PUBLIC');
      postAId = res.body.id;
    });

    it('should upload valid media attachment for Student A', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const res = await request(app.getHttpServer())
        .post('/posts/media/upload')
        .set('Authorization', `Bearer ${studentA.token}`)
        .set('Content-Type', 'image/jpeg')
        .send(jpegBuffer);
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.uploadId).toBeDefined();
      uploadIdA = res.body.uploadId;
    });

    it('should REJECT MEDIA OWNERSHIP VIOLATION: Student B attaching Student A uploadId returns 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ content: 'Malicious post', mediaUploadIds: [uploadIdA] });
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should create a post with CONNECTIONS_ONLY visibility for Student A', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: 'Exclusive connections update', visibility: 'CONNECTIONS_ONLY' });
      expect(res.status).toBe(HttpStatus.CREATED);
      postConnId = res.body.id;
    });
  });

  describe('Post Visibility Enforcement', () => {
    it('should allow non-connected Student C to view Student A PUBLIC post', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentC.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.id).toBe(postAId);
    });

    it('should allow connected Student B to view Student A CONNECTIONS_ONLY post', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postConnId}`)
        .set('Authorization', `Bearer ${studentB.token}`);
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('should REJECT non-connected Student C viewing Student A CONNECTIONS_ONLY post with 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postConnId}`)
        .set('Authorization', `Bearer ${studentC.token}`);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Likes System & Transactional Counters', () => {
    it('should allow Student C to like Student A PUBLIC post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/posts/${postAId}/like`)
        .set('Authorization', `Bearer ${studentC.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.isLiked).toBe(true);

      const postRes = await request(app.getHttpServer())
        .get(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(postRes.body.likesCount).toBe(1);
    });

    it('should REJECT DUPLICATE LIKE with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post(`/posts/${postAId}/like`)
        .set('Authorization', `Bearer ${studentC.token}`);
      expect(res.status).toBe(HttpStatus.CONFLICT);
    });

    it('should allow Student C to unlike post and decrement counter', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/posts/${postAId}/like`)
        .set('Authorization', `Bearer ${studentC.token}`);
      expect(res.status).toBe(HttpStatus.OK);

      const postRes = await request(app.getHttpServer())
        .get(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(postRes.body.likesCount).toBe(0);
    });
  });

  describe('Comments System & Cursor Pagination', () => {
    it('should allow Student C to add flat comment on Student A post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/posts/${postAId}/comments`)
        .set('Authorization', `Bearer ${studentC.token}`)
        .send({ content: 'Great post Student A!' });
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.content).toBe('Great post Student A!');
      commentIdC = res.body.id;

      const postRes = await request(app.getHttpServer())
        .get(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(postRes.body.commentsCount).toBe(1);
    });

    it('should allow Comment Author Student C to edit comment content', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/posts/comments/${commentIdC}`)
        .set('Authorization', `Bearer ${studentC.token}`)
        .send({ content: 'Great post Student A! Edited.' });
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.content).toBe('Great post Student A! Edited.');
    });

    it('should REJECT non-author Student A attempting to edit Student C comment with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/posts/comments/${commentIdC}`)
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ content: 'Hacked comment' });
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should return paginated comments list for post', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postAId}/comments`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].content).toBe('Great post Student A! Edited.');
    });

    it('should allow Comment Author Student C to soft delete comment and decrement counter', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/posts/comments/${commentIdC}`)
        .set('Authorization', `Bearer ${studentC.token}`);
      expect(res.status).toBe(HttpStatus.OK);

      const postRes = await request(app.getHttpServer())
        .get(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(postRes.body.commentsCount).toBe(0);
    });
  });

  describe('Block Overrides & Privacy Interception', () => {
    it('should ENFORCE BLOCK PRIVACY: Student B blocks Student A -> Student A viewing B post returns 404', async () => {
      // 1. Student B creates a public post
      const bPostRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({ content: 'Public post by Student B', visibility: 'PUBLIC' });
      const bPostId = bPostRes.body.id;

      // 2. Student B blocks Student A
      await request(app.getHttpServer())
        .post(`/networking/block/${studentA.id}`)
        .set('Authorization', `Bearer ${studentB.token}`);

      // 3. Student A attempts to view Student B post -> 404 Not Found
      const res = await request(app.getHttpServer())
        .get(`/posts/${bPostId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);

      // 4. Student A attempts to like Student B post -> 404 Not Found
      const likeRes = await request(app.getHttpServer())
        .post(`/posts/${bPostId}/like`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(likeRes.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Post Soft Deletion', () => {
    it('should allow Post Author Student A to soft delete post', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(HttpStatus.OK);

      // Soft deleted post returns 404 Not Found on retrieval
      const getRes = await request(app.getHttpServer())
        .get(`/posts/${postAId}`)
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(getRes.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
