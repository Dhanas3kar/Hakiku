import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AdminController } from '../src/admin/admin.controller';

// Mock Guards and Services
import { JwtAuthGuard } from '../src/networking/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { AdminService } from '../src/admin/services/admin.service';
import { MetricsService } from '../src/metrics/metrics.service';

describe('Admin DTO Validation (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            resolveReport: jest.fn().mockResolvedValue({ success: true }),
            setUserStatus: jest.fn().mockResolvedValue({ success: true }),
            moderatePost: jest.fn().mockResolvedValue({ success: true }),
            moderateComment: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: MetricsService,
          useValue: { currentMetrics: {} },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: any) => { context.switchToHttp().getRequest().user = { sub: 'admin_id' }; return true; } })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /admin/reports/:id', () => {
    it('should succeed with valid payload', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/reports/123')
        .send({ action: 'DISMISS', reason: 'False positive' });
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should reject invalid action enum', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/reports/123')
        .send({ action: 'INVALID_ACTION' });
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('action must be one of the following values')]));
    });

    it('should reject unknown properties', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/reports/123')
        .send({ action: 'DISMISS', maliciousField: true });
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('property maliciousField should not exist')]));
    });
  });

  describe('PATCH /admin/users/:id/status', () => {
    it('should succeed with valid payload', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/users/123/status')
        .send({ status: 'BANNED', reason: 'Violation' });
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should reject invalid status enum', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/users/123/status')
        .send({ status: 'SUSPENDED', reason: 'Violation' });
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('status must be one of the following values')]));
    });

    it('should reject missing required reason field', async () => {
      const response = await request(app.getHttpServer())
        .patch('/admin/users/123/status')
        .send({ status: 'BANNED' });
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('reason must be a string')]));
    });
  });

  describe('DELETE /admin/posts/:id', () => {
    it('should succeed with valid payload', async () => {
      const response = await request(app.getHttpServer())
        .delete('/admin/posts/123')
        .send({ reason: 'Spam' });
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should reject missing required reason field', async () => {
      const response = await request(app.getHttpServer())
        .delete('/admin/posts/123')
        .send({});
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('reason should not be empty')]));
    });
  });
});
