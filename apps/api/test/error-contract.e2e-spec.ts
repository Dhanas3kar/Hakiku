import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './../src/filters/global-exception.filter';
import * as crypto from 'crypto';
import { Controller, Get } from '@nestjs/common';

@Controller('test-errors')
class TestErrorsController {
  @Get('500')
  trigger500() {
    throw new Error('This is a highly sensitive internal database error: connection failed to 10.0.0.1 with password secret123');
  }
}

describe('Error Contract & Correlation ID (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestErrorsController],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        genReqId: (req) => {
          return (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
        },
      }),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('A. Validation error has the standard structure', async () => {
    // Send a payload to an endpoint that requires validation, like an invalid auth payload
    const response = await app.inject({
      method: 'POST',
      url: '/auth/send-otp',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    
    expect(body).toHaveProperty('statusCode', 400);
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body.message).toContain('email must be an email');
    expect(body).toHaveProperty('correlationId');
    expect(typeof body.correlationId).toBe('string');
  });

  it('B. Authentication failure has the standard structure', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/profile/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('statusCode', 401);
    expect(body).toHaveProperty('code', 'AUTH_FAILED');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('correlationId');
  });

  it('C. Not-found failure has the standard structure', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('statusCode', 404);
    expect(body).toHaveProperty('code', 'NOT_FOUND');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('correlationId');
  });

  it('D. Unexpected 500 error does NOT expose internal exception details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-errors/500',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);

    expect(body).toHaveProperty('statusCode', 500);
    expect(body).toHaveProperty('code', 'INTERNAL_ERROR');
    expect(body).toHaveProperty('message', 'An unexpected error occurred');
    expect(body).toHaveProperty('correlationId');
    
    // Ensure sensitive details are not leaked
    const payloadStr = response.payload.toLowerCase();
    expect(payloadStr).not.toContain('database');
    expect(payloadStr).not.toContain('secret123');
    expect(payloadStr).not.toContain('10.0.0.1');
  });

  it('E & G. Correlation ID is stable throughout one request and uses x-correlation-id if provided', async () => {
    const providedId = 'client-provided-id-123';
    const response = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
      headers: { 'x-correlation-id': providedId },
    });

    const body = JSON.parse(response.payload);
    expect(body.correlationId).toBe(providedId);
  });

  it('F. Two independent requests receive different correlation IDs', async () => {
    const response1 = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
    });
    
    const response2 = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
    });

    const body1 = JSON.parse(response1.payload);
    const body2 = JSON.parse(response2.payload);

    expect(body1.correlationId).toBeDefined();
    expect(body2.correlationId).toBeDefined();
    expect(body1.correlationId).not.toBe(body2.correlationId);
  });
});
