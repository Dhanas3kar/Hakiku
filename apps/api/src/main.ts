import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import fastifyStatic from '@fastify/static';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';
import { db } from './db';
import { sql } from 'drizzle-orm';

async function bootstrap() {
  const requiredEnv = ['COOKIE_SECRET', 'JWT_SECRET', 'DATABASE_URL'];
  for (const env of requiredEnv) {
    if (!process.env[env]) {
      throw new Error(`CRITICAL: Missing required environment variable ${env}. The application will not start with insecure defaults.`);
    }
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }),
  );

  await app.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET!,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
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

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
