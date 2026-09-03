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
import { users, profiles } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Production Deployment Smoke Suite (E2E)', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;

  let smokeUser: { id: string; email: string; token: string };
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

    // Provision smoke test user
    const tag = crypto.randomUUID().slice(-8);
    const email = `smoke_${tag}@srmist.edu.in`;
    const [u] = await db
      .insert(users)
      .values({ email, isVerified: true, role: 'STUDENT' })
      .returning();

    await db.insert(profiles).values({
      userId: u.id,
      username: `smoke_${tag}`,
      displayName: 'Smoke Test User',
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2020,
      graduationYear: 2024,
    });

    const token = await jwtService.signAsync(
      { sub: u.id, email, role: 'STUDENT' },
      { issuer: jwtIssuer, audience: jwtAudience },
    );

    smokeUser = { id: u.id, email, token };
  });

  afterAll(async () => {
    await app.close();
    if (smokeUser?.id) {
      await db.delete(users).where(eq(users.id, smokeUser.id));
    }
  });

  describe('1. Health Probes', () => {
    it('GET /health/liveness -> 200 OK', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/liveness' });
      expect(res.statusCode).toBe(HttpStatus.OK);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('up');
    });

    it('GET /health/readiness -> 200 OK', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/readiness' });
      expect(res.statusCode).toBe(HttpStatus.OK);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('ready');
    });
  });

  describe('2. User Core Journey', () => {
    it('GET /feed -> 200 OK with authenticated session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/feed',
        headers: { authorization: `Bearer ${smokeUser.token}` },
      });
      expect(res.statusCode).toBe(HttpStatus.OK);
    });

    it('GET /notifications -> 200 OK with authenticated session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
        headers: { authorization: `Bearer ${smokeUser.token}` },
      });
      expect(res.statusCode).toBe(HttpStatus.OK);
    });
  });

  describe('3. Prometheus Exposition', () => {
    it('GET /metrics -> 200 OK returning Prometheus exposition text', async () => {
      const res = await app.inject({ method: 'GET', url: '/metrics' });
      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('text/plain');
    });
  });
});
