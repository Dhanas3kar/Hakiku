import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from '../src/app.module';
import { db } from '../src/db';
import {
  users,
  profiles,
  confessions,
  polls,
  pollOptions,
  pollVotes,
  communityReports,
} from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';

describe('CommunityModule (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  let userAToken: string;
  let userAId: string;

  let userBToken: string;
  let userBId: string;

  let modToken: string;
  let modId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.register(fastifyCookie as any, { secret: 'test-secret' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed',
    });

    // Pre-cleanup in case of previous test failure
    await db.delete(users).where(eq(users.email, 'communitya@srmist.edu.in'));
    await db.delete(users).where(eq(users.email, 'communityb@srmist.edu.in'));
    await db.delete(users).where(eq(users.email, 'communitymod@srmist.edu.in'));

    // Seed test users
    const userA = await db
      .insert(users)
      .values({
        email: 'communitya@srmist.edu.in',
        fullName: 'Community User A',
        authProvider: 'EMAIL',
        providerId: 'commA',
        isVerified: true,
        status: 'ACTIVE',
        role: 'STUDENT',
      })
      .returning();
    userAId = userA[0].id;

    await db.insert(profiles).values({
      userId: userAId,
      username: 'communitya',
      displayName: 'Community A',
      campus: 'KTR',
      degreeProgram: 'B.Tech',
      batchYear: '2025',
      graduationYear: 2029,
      department: 'CSE',
    });

    userAToken = jwtService.sign({
      sub: userAId,
      email: userA[0].email,
      role: 'STUDENT',
    });

    const userB = await db
      .insert(users)
      .values({
        email: 'communityb@srmist.edu.in',
        fullName: 'Community User B',
        authProvider: 'EMAIL',
        providerId: 'commB',
        isVerified: true,
        status: 'ACTIVE',
        role: 'STUDENT',
      })
      .returning();
    userBId = userB[0].id;

    await db.insert(profiles).values({
      userId: userBId,
      username: 'communityb',
      displayName: 'Community B',
      campus: 'KTR',
      degreeProgram: 'B.Tech',
      batchYear: 2025,
      graduationYear: 2029,
      department: 'ECE',
    });

    userBToken = jwtService.sign({
      sub: userBId,
      email: userB[0].email,
      role: 'STUDENT',
    });

    const modUser = await db
      .insert(users)
      .values({
        email: 'communitymod@srmist.edu.in',
        fullName: 'Community Moderator',
        authProvider: 'EMAIL',
        providerId: 'commMod',
        isVerified: true,
        status: 'ACTIVE',
        role: 'MODERATOR',
      })
      .returning();
    modId = modUser[0].id;

    await db.insert(profiles).values({
      userId: modId,
      username: 'communitymod',
      displayName: 'Community Mod',
      campus: 'KTR',
      degreeProgram: 'B.Tech',
      batchYear: 2025,
      graduationYear: 2029,
      department: 'CSE',
    });

    modToken = jwtService.sign({
      sub: modId,
      email: modUser[0].email,
      role: 'MODERATOR',
    });
  });

  afterAll(async () => {
    // Cleanup
    if (userAId) {
      await db.delete(pollVotes).where(eq(pollVotes.userId, userAId));
      await db.delete(pollOptions);
      await db.delete(polls).where(eq(polls.authorId, userAId));
      await db.delete(confessions).where(eq(confessions.authorId, userAId));
      await db
        .delete(communityReports)
        .where(eq(communityReports.reporterId, userAId));
      await db.delete(profiles).where(eq(profiles.userId, userAId));
      await db.delete(users).where(eq(users.id, userAId));
    }
    if (userBId) {
      await db.delete(profiles).where(eq(profiles.userId, userBId));
      await db.delete(users).where(eq(users.id, userBId));
    }
    if (modId) {
      await db.delete(profiles).where(eq(profiles.userId, modId));
      await db.delete(users).where(eq(users.id, modId));
    }

    await app.close();
  });

  describe('Confessions', () => {
    let confessionId: string;

    it('POST /community/confessions (creates a confession)', async () => {
      const response = await request(app.getHttpServer())
        .post('/community/confessions')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          content: 'I love programming in NestJS',
          campus: 'KTR',
        });

      if (response.status !== 201) {
        if (response.status === 401) {
          console.log('401 Body:', response.body);
        }
      }
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Confession submitted for moderation');
      expect(response.body.id).toBeDefined();
      confessionId = response.body.id;
    });

    it('STUDENT: POST /community/moderation/confessions/:id/approve (returns 403)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/community/moderation/confessions/${confessionId}/approve`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(403);
    });

    it('STUDENT: POST /community/moderation/confessions/:id/reject (returns 403)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/community/moderation/confessions/${confessionId}/reject`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(403);
    });

    it('STUDENT: DELETE /community/moderation/confessions/:id (returns 403)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/community/moderation/confessions/${confessionId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(403);
    });

    it('MODERATOR: POST /community/moderation/confessions/:id/approve (approves confession)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/community/moderation/confessions/${confessionId}/approve`)
        .set('Authorization', `Bearer ${modToken}`);

      expect(response.status).toBe(200);
    });

    it('GET /community/confessions/hero (returns active hero confession)', async () => {
      const response = await request(app.getHttpServer())
        .get('/community/confessions/hero')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('I love programming in NestJS');
      expect(response.body.id).toBe(confessionId);
      // Ensure authorId is NOT leaked
      expect(response.body.authorId).toBeUndefined();
    });
  });

  describe('Polls', () => {
    let pollId: string;
    let optionId: string;

    it('POST /community/polls (creates a poll)', async () => {
      const response = await request(app.getHttpServer())
        .post('/community/polls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          question: 'Best language?',
          options: ['TypeScript', 'Python'],
          isMultipleChoice: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      pollId = response.body.id;
    });

    it('GET /community/polls/:id (fetches poll details with options)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/community/polls/${pollId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.options).toHaveLength(2);
      optionId = response.body.options[0].id;
    });

    it('POST /community/polls/:id/vote (votes on an option)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/community/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ optionId });

      expect(response.status).toBe(200);
    });

    it('POST /community/polls/:id/vote (prevents double voting on single choice)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/community/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ optionId });

      expect(response.status).toBe(409); // Conflict
    });

    it('DELETE /community/polls/:id/vote (removes the vote)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/community/polls/${pollId}/vote`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ optionId });

      expect(response.status).toBe(200);
    });
  });

  describe('Campus Intelligence', () => {
    it('GET /community/campus/pulse', async () => {
      const response = await request(app.getHttpServer())
        .get('/community/campus/pulse')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activePosts');
      expect(response.body).toHaveProperty('activeComments');
      expect(response.body).toHaveProperty('newConnections');
    });

    it('GET /community/campus/insights', async () => {
      const response = await request(app.getHttpServer())
        .get('/community/campus/insights')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.campus).toBe('KTR');
    });
  });

  describe('People Worth Knowing', () => {
    it('GET /community/people/recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/community/people/recommendations')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.items)).toBeTruthy();
    });
  });

  describe('Moderation Reports', () => {
    it('POST /community/report', async () => {
      const response = await request(app.getHttpServer())
        .post('/community/report')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetType: 'USER',
          targetId: userBId,
          reason: 'Spamming connection requests',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
    });

    it('STUDENT: GET /community/moderation/reports (returns 403)', async () => {
      const response = await request(app.getHttpServer())
        .get('/community/moderation/reports')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(403);
    });

    it('MODERATOR: GET /community/moderation/reports (returns list)', async () => {
      const response = await request(app.getHttpServer())
        .get('/community/moderation/reports')
        .set('Authorization', `Bearer ${modToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
