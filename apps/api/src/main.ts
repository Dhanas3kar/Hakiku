import 'dotenv/config';
import { IncomingMessage } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import fastifyHelmet from '@fastify/helmet';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import fastifyStatic from '@fastify/static';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import { db } from './db';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';

async function bootstrap() {
  const requiredEnv = ['COOKIE_SECRET', 'JWT_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE', 'DATABASE_URL', 'OTP_SECRET'];
  for (const env of requiredEnv) {
    if (!process.env[env]) {
      throw new Error(`CRITICAL: Missing required environment variable ${env}. The application will not start with insecure defaults.`);
    }
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 10 * 1024 * 1024,
      genReqId: (req: IncomingMessage) => {
        return (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
      }
    }),
  );

  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false, // APIs don't typically need CSP, and we want to avoid breaking static/WebSocket integrations
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET!,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.register(fastifyCsrf as any, {
    cookieOpts: { signed: true },
  });

  await app.register(fastifyStatic as any, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', (req, reply, done) => {
    const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    // Fastify-csrf only requires protection on non-GET/HEAD/OPTIONS methods normally.
    // Our frontend must send the csrf token in the headers for all these requests.
    if (stateChangingMethods.includes(req.method)) {
      if (typeof (req as any).csrfProtect === 'function') {
        (req as any).csrfProtect(reply, done);
      } else {
        done();
      }
    } else {
      done();
    }
  });

  let allowedOrigins: (string | RegExp)[] | string = 'http://localhost:3000';
  if (process.env.CORS_ALLOWED_ORIGINS) {
    allowedOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  } else if (process.env.FRONTEND_URL) {
    allowedOrigins = [process.env.FRONTEND_URL];
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  fastifyInstance.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req: any, payload: any, done: any) => {
      done(null, payload);
    },
  );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
