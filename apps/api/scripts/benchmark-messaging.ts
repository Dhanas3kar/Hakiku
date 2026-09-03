import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { db } from '../src/db';
import {
  users,
  profiles,
  connections,
  conversations,
  conversationParticipants,
} from '../src/db/schema';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';

const CONCURRENCY_LEVELS = [1, 5, 10, 25, 50, 100, 250, 500];
const WARMUP_REQUESTS = 20;
const BENCHMARK_PREFIX = 'bench_msg_';

interface MessagingBenchmarkResult {
  endpoint: string;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  requestsPerSecond: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
}

function calculatePercentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

async function runMessagingBenchmark() {
  console.log('--- INITIALIZING PHASE 2 MESSAGING BENCHMARK ---');

  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false }
  );

  await app.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || 'test-secret-that-is-at-least-32-chars-long',
  });

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

  const jwtService = app.get(JwtService);

  const totalRequestsNeeded = WARMUP_REQUESTS + CONCURRENCY_LEVELS.reduce((a, b) => a + b, 0);
  console.log(`Provisioning ${totalRequestsNeeded} users & conversations...`);

  const userIds: string[] = [];
  const userTokens: string[] = [];
  const userValues: (typeof users.$inferInsert)[] = [];
  const profileValues: (typeof profiles.$inferInsert)[] = [];

  for (let i = 0; i < totalRequestsNeeded; i++) {
    const id = crypto.randomUUID();
    userIds.push(id);
    userValues.push({
      id,
      email: `${BENCHMARK_PREFIX}${i}_${id.slice(-6)}@srmist.edu.in`,
      isVerified: true,
    });
    profileValues.push({
      userId: id,
      username: `${BENCHMARK_PREFIX}${i}_${id.slice(-6)}`,
      displayName: `Bench Msg User ${i}`,
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2020,
      graduationYear: 2024,
    });
    const token = await jwtService.signAsync({
      sub: id,
      email: userValues[i].email,
    });
    userTokens.push(token);
  }

  await db.insert(users).values(userValues);
  await db.insert(profiles).values(profileValues);

  const targetConvIds: string[] = [];
  const convValues: (typeof conversations.$inferInsert)[] = [];
  const participantValues: (typeof conversationParticipants.$inferInsert)[] = [];
  const connectionValues: (typeof connections.$inferInsert)[] = [];

  for (let i = 0; i < totalRequestsNeeded; i++) {
    const cid = crypto.randomUUID();
    targetConvIds.push(cid);

    const u1 = userIds[i];
    const u2 = userIds[(i + 1) % totalRequestsNeeded];
    const [userAId, userBId] = u1 < u2 ? [u1, u2] : [u2, u1];

    convValues.push({ id: cid, userAId, userBId });
    participantValues.push({ conversationId: cid, userId: userAId });
    participantValues.push({ conversationId: cid, userId: userBId });
    connectionValues.push({ userAId, userBId });
  }

  await db.insert(connections).values(connectionValues).onConflictDoNothing();
  await db.insert(conversations).values(convValues);
  await db.insert(conversationParticipants).values(participantValues);

  console.log('Messaging test data provisioned.');

  const results: MessagingBenchmarkResult[] = [];

  let requestCounter = 0;

  console.log('\n--- SCENARIO: POST /messages/conversations/:id/messages ---');
  // Warmup
  const warmupPromises = [];
  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    const idx = requestCounter++;
    warmupPromises.push(
      app.inject({
        method: 'POST',
        url: `/messaging/conversations/${targetConvIds[idx]}/messages`,
        headers: { authorization: `Bearer ${userTokens[idx]}` },
        payload: { content: 'Warmup message', messageType: 'TEXT' },
      })
    );
  }
  await Promise.all(warmupPromises);

  for (const concurrency of CONCURRENCY_LEVELS) {
    const startTime = process.hrtime.bigint();
    const latencies = new Float64Array(concurrency);
    const requests = [];

    for (let i = 0; i < concurrency; i++) {
      const idx = requestCounter++;
      requests.push(
        (async () => {
          const reqStart = process.hrtime.bigint();
          const response = await app.inject({
            method: 'POST',
            url: `/messaging/conversations/${targetConvIds[idx]}/messages`,
            headers: { authorization: `Bearer ${userTokens[idx]}` },
            payload: { content: `Bench message content ${i}`, messageType: 'TEXT' },
          });
          const reqEnd = process.hrtime.bigint();
          latencies[i] = Number(reqEnd - reqStart) / 1_000_000;
          return response;
        })()
      );
    }

    const responses = await Promise.all(requests);
    const endTime = process.hrtime.bigint();
    const totalElapsedMs = Number(endTime - startTime) / 1_000_000;
    const rps = (concurrency / totalElapsedMs) * 1000;

    let successfulRequests = 0;
    let failedRequests = 0;
    for (const res of responses) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    }

    const sorted = Array.from(latencies).sort((a, b) => a - b);
    const p50 = calculatePercentile(sorted, 50);
    const p95 = calculatePercentile(sorted, 95);
    const p99 = calculatePercentile(sorted, 99);
    const max = sorted[sorted.length - 1];

    results.push({
      endpoint: 'POST /messages',
      concurrency,
      totalRequests: concurrency,
      successfulRequests,
      failedRequests,
      requestsPerSecond: rps,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      maxLatencyMs: max,
    });

    console.log(
      `Conc: ${concurrency.toString().padStart(3)} | Success: ${successfulRequests.toString().padStart(3)} | ` +
      `Req/s: ${rps.toFixed(1).padStart(6)} | p50: ${p50.toFixed(1).padStart(5)}ms | ` +
      `p95: ${p95.toFixed(1).padStart(5)}ms | p99: ${p99.toFixed(1).padStart(5)}ms`
    );
  }

  await app.close();

  const reportPath = path.join(__dirname, 'messaging-benchmark-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nMessaging benchmark results saved to ${reportPath}`);
}

runMessagingBenchmark().catch((err) => {
  console.error('Messaging benchmark failed:', err);
  process.exit(1);
});
