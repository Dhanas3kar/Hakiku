import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrf from '@fastify/csrf-protection';
import fastifyStatic from '@fastify/static';
import { ValidationPipe } from '@nestjs/common';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET || 'super-secret',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.register(fastifyCsrf as any, {
    cookieOpts: { signed: true },
  });

  await app.register(fastifyStatic as any, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', (req, reply, done) => {
    if (req.url.includes('/logout') && req.method === 'POST') {
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
    origin: true, // reflect request origin
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
