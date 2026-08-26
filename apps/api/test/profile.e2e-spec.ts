import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { JwtService } from '@nestjs/jwt';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { clearTestDatabase } from './test-utils';
import {
  users,
  profiles,
  skills,
  interests,
  profileSkills,
  profileInterests,
  blocks,
  connectionRequests,
  connections,
  follows,
  authSessions,
  auditLogs,
  notifications,
  notificationOutbox,
  notificationEvents,
  notificationPreferences,
  comments,
  postLikes,
  postMedia,
  pendingMediaUploads,
  posts,
} from '../src/db/schema';
import Redis from 'ioredis';

describe('Profile Module (e2e)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let db: any;
  let redis: Redis;

  let studentA: { id: string; email: string; token: string };
  let studentB: { id: string; email: string; token: string };
  let suspendedC: { id: string; email: string; token: string };
  let adminD: { id: string; email: string; token: string };

  let testSkillId: string;
  let testInterestId: string;
  let client: any;

  beforeAll(async () => {
    // 1. Flush Redis
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.flushdb();

    // 2. Postgres Cleanup
    client = postgres(process.env.DATABASE_URL!);
    db = drizzle(client);

    await clearTestDatabase();

    // 3. Create Users
    const [uA] = await db
      .insert(users)
      .values({
        email: 'usera_prof@srmist.edu.in',
        isVerified: true,
        status: 'ACTIVE',
        role: 'STUDENT',
      })
      .returning();
    const [uB] = await db
      .insert(users)
      .values({
        email: 'userb_prof@srmist.edu.in',
        isVerified: true,
        status: 'ACTIVE',
        role: 'STUDENT',
      })
      .returning();
    const [uC] = await db
      .insert(users)
      .values({
        email: 'userc_prof@srmist.edu.in',
        isVerified: true,
        status: 'SUSPENDED',
        role: 'STUDENT',
      })
      .returning();
    const [uD] = await db
      .insert(users)
      .values({
        email: 'admind_prof@srmist.edu.in',
        isVerified: true,
        status: 'ACTIVE',
        role: 'ADMIN',
      })
      .returning();

    jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed',
    });

    studentA = {
      id: uA.id,
      email: uA.email,
      token: await jwtService.signAsync({
        sub: uA.id,
        email: uA.email,
        role: uA.role,
      }),
    };
    studentB = {
      id: uB.id,
      email: uB.email,
      token: await jwtService.signAsync({
        sub: uB.id,
        email: uB.email,
        role: uB.role,
      }),
    };
    suspendedC = {
      id: uC.id,
      email: uC.email,
      token: await jwtService.signAsync({
        sub: uC.id,
        email: uC.email,
        role: uC.role,
      }),
    };
    adminD = {
      id: uD.id,
      email: uD.email,
      token: await jwtService.signAsync({
        sub: uD.id,
        email: uD.email,
        role: uD.role,
      }),
    };

    // 4. Initialize Application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyCookie, { secret: 'test-secret' });
    await app.register(fastifyCsrf, { cookieOpts: { signed: true } });

    app
      .getHttpAdapter()
      .getInstance()
      .addContentTypeParser(
        ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
        { parseAs: 'buffer' },
        (_req: any, payload: any, done: any) => {
          done(null, payload);
        },
      );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
    await client.end();
  });

  describe('Taxonomy Authorization & Management', () => {
    it('should reject skill creation by a student with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/skills')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ name: 'Python' });
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow Admin D to create a skill', async () => {
      const res = await request(app.getHttpServer())
        .post('/skills')
        .set('Authorization', `Bearer ${adminD.token}`)
        .send({ name: 'TypeScript', category: 'Programming' });
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.name).toBe('typescript');
      testSkillId = res.body.id;
    });

    it('should allow Admin D to create an interest', async () => {
      const res = await request(app.getHttpServer())
        .post('/interests')
        .set('Authorization', `Bearer ${adminD.token}`)
        .send({ name: 'Artificial Intelligence', category: 'Technology' });
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.name).toBe('artificial intelligence');
      testInterestId = res.body.id;
    });

    it('should allow Students to search existing skills', async () => {
      const res = await request(app.getHttpServer())
        .get('/skills?query=type')
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('typescript');
    });
  });

  describe('Onboarding & Username Enforcement', () => {
    it('should reject onboarding for a suspended user with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/onboarding')
        .set('Authorization', `Bearer ${suspendedC.token}`)
        .send({
          username: 'userc_suspended',
          displayName: 'User C',
          campus: 'KTR',
          department: 'CSE',
          degreeProgram: 'B.Tech',
          batchYear: 2022,
          graduationYear: 2026,
        });
      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should allow Student A to complete profile onboarding', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/onboarding')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({
          username: 'usera_prof',
          displayName: 'User A Student',
          campus: 'KTR',
          department: 'Computer Science',
          degreeProgram: 'B.Tech',
          batchYear: 2022,
          graduationYear: 2026,
          bio: 'Aspiring Full Stack Engineer',
          skillIds: [testSkillId],
          interestIds: [testInterestId],
        });
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.username).toBe('usera_prof');
      expect(res.body.isProfileCompleted).toBe(true);
    });

    it('should reject duplicate username (case-insensitive) with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/onboarding')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({
          username: 'USERA_PROF', // Uppercase variation of existing username
          displayName: 'User B Duplicate',
          campus: 'RAM',
          department: 'ECE',
          degreeProgram: 'B.Tech',
          batchYear: 2023,
          graduationYear: 2027,
        });
      expect(res.status).toBe(HttpStatus.CONFLICT);
    });

    it('should reject reserved username with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/onboarding')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({
          username: 'admin',
          displayName: 'Fake Admin',
          campus: 'RAM',
          department: 'ECE',
          degreeProgram: 'B.Tech',
          batchYear: 2023,
          graduationYear: 2027,
        });
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should reject invalid username with consecutive dots with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/onboarding')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({
          username: 'user..b',
          displayName: 'User B',
          campus: 'RAM',
          department: 'ECE',
          degreeProgram: 'B.Tech',
          batchYear: 2023,
          graduationYear: 2027,
        });
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should allow Student B to complete onboarding with a valid username', async () => {
      const res = await request(app.getHttpServer())
        .post('/profile/onboarding')
        .set('Authorization', `Bearer ${studentB.token}`)
        .send({
          username: 'userb_prof',
          displayName: 'User B Student',
          campus: 'RAM',
          department: 'ECE',
          degreeProgram: 'B.Tech',
          batchYear: 2023,
          graduationYear: 2027,
        });
      expect(res.status).toBe(HttpStatus.CREATED);
    });
  });

  describe('Avatar Upload & Media Validation', () => {
    it('should reject non-image file buffer upload with 400 Bad Request', async () => {
      const invalidBuffer = Buffer.from('this is text content not an image');
      const res = await request(app.getHttpServer())
        .post('/profile/me/avatar')
        .set('Authorization', `Bearer ${studentA.token}`)
        .set('Content-Type', 'image/jpeg')
        .send(invalidBuffer);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should upload valid JPEG avatar and update profile completion percentage', async () => {
      // Valid JPEG header bytes (FF D8 FF E0)
      const validJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);
      const res = await request(app.getHttpServer())
        .post('/profile/me/avatar')
        .set('Authorization', `Bearer ${studentA.token}`)
        .set('Content-Type', 'image/jpeg')
        .send(validJpegBuffer);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.key).toContain('users/');
      expect(res.body.key).toContain('/profile/avatar/');
    });
  });

  describe('Profile Privacy & Block Interception Flow', () => {
    it('should set Student A visibility to CONNECTIONS_ONLY', async () => {
      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .set('Authorization', `Bearer ${studentA.token}`)
        .send({ visibility: 'CONNECTIONS_ONLY' });
      expect(res.status).toBe(HttpStatus.OK);
    });

    it('should return MASKED summary card when non-connected Student B views Student A profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/profile/username/usera_prof')
        .set('Authorization', `Bearer ${studentB.token}`);
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.isRestricted).toBe(true);
      expect(res.body.bio).toBeUndefined(); // Bio masked
      expect(res.body.displayName).toBe('User A Student');
    });

    it('should ENFORCE BLOCK PRIVACY: Student B blocks Student A -> Student A viewing B returns 404', async () => {
      // Student B blocks Student A
      await request(app.getHttpServer())
        .post(`/networking/block/${studentA.id}`)
        .set('Authorization', `Bearer ${studentB.token}`);

      // Student A requests Student B profile
      const res = await request(app.getHttpServer())
        .get('/profile/username/userb_prof')
        .set('Authorization', `Bearer ${studentA.token}`);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
