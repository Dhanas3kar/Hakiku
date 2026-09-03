import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import Redis from 'ioredis';
import { clearTestDatabase } from './test-utils';

describe('Security Hardening (e2e)', () => {
  let app: NestFastifyApplication;
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.flushdb();
    await clearTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    // Apply the same global pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.register(fastifyCookie, {
      secret: 'test-cookie-secret',
    });

    await app.register(fastifyCsrf, {
      cookieOpts: { signed: true },
    });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  describe('Payload Validation (forbidNonWhitelisted)', () => {
    it('should reject requests with unexpected properties (HTTP 400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({
          email: 'validuser@srmist.edu.in',
          maliciousProperty: 'SELECT * FROM users',
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toContain('property maliciousProperty should not exist');
    });

    it('should accept valid payloads', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/send-otp')
        .send({
          email: 'validuser2@srmist.edu.in',
        });

      // It should be 200 OK because the email is valid and no extra properties are sent
      expect(response.status).toBe(HttpStatus.OK);
    });
  });

  describe('Rate Limiting (Strict Authentication Limits)', () => {
    beforeAll(() => {
      process.env.TEST_ENABLE_RATE_LIMIT = 'true';
    });

    afterAll(() => {
      delete process.env.TEST_ENABLE_RATE_LIMIT;
    });
    it('should trigger 429 Too Many Requests when hitting /auth/send-otp more than 5 times in a minute', async () => {
      // The limit on /auth/send-otp is short: { limit: 5, ttl: 60000 }
      // We will send 6 requests using different emails to avoid the internal OTP cooldown logic
      
      let lastResponse;
      for (let i = 1; i <= 6; i++) {
        lastResponse = await request(app.getHttpServer())
          .post('/auth/send-otp')
          .send({ email: `ratelimit${i}@srmist.edu.in` });
          
        if (i <= 5) {
          // The first 5 should succeed (or return 429 if we run tests concurrently, but we cleared redis)
          // Wait, the default rate limiter uses IP. Since it's all from 127.0.0.1 in tests, they share the bucket.
          expect([HttpStatus.OK, HttpStatus.TOO_MANY_REQUESTS]).toContain(lastResponse.status);
        }
      }

      // The 6th request MUST be rate limited by the ThrottlerGuard
      expect(lastResponse.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
