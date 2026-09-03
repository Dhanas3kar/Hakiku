import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpStatus } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';

describe('Observability & Readiness (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyCookie as any, { secret: 'test-secret' });
    await app.register(fastifyCsrf as any, { cookieOpts: { signed: true } });

    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Prometheus Exposition Endpoint (GET /metrics)', () => {
    it('should return 200 OK with valid Prometheus text exposition format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(res.statusCode).toBe(HttpStatus.OK);
      expect(res.headers['content-type']).toContain('text/plain');

      const payload = res.payload;
      expect(payload).toContain('hakiku_http_requests_total');
      expect(payload).toContain('hakiku_event_loop_lag_p95_seconds');
      expect(payload).toContain('hakiku_memory_rss_bytes');
      expect(payload).toContain('hakiku_pg_connections_active');
      expect(payload).toContain('hakiku_notification_outbox_pending_total');
      expect(payload).toContain('hakiku_message_outbox_pending_total');
      expect(payload).toContain('hakiku_ws_connections');
    });

    it('should record HTTP request metrics when making API calls', async () => {
      // Trigger a known request
      await app.inject({
        method: 'GET',
        url: '/health/liveness',
      });

      const metricsRes = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(metricsRes.statusCode).toBe(HttpStatus.OK);
      expect(metricsRes.payload).toContain('hakiku_http_requests_total');
    });
  });

  describe('Liveness Probe (GET /health/liveness)', () => {
    it('should return 200 OK with process health and event loop telemetry', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/liveness',
      });

      expect(res.statusCode).toBe(HttpStatus.OK);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('up');
      expect(body.liveness).toBe('healthy');
      expect(typeof body.eventLoopLagMs).toBe('number');
    });
  });

  describe('Readiness Probe (GET /health/readiness)', () => {
    it('should return 200 OK when PostgreSQL and Redis are healthy', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/readiness',
      });

      expect(res.statusCode).toBe(HttpStatus.OK);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('ready');
      expect(body.checks.postgres).toBe('up');
      expect(body.checks.redis).toBe('up');
    });
  });
});
