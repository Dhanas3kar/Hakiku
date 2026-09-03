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
  posts,
  follows,
  connections,
  conversations,
  conversationParticipants,
  messages,
  notifications,
  notificationOutbox,
  messageOutbox,
} from '../src/db/schema';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';
import { MetricsService } from '../src/metrics/metrics.service';
import fastifyCookie from '@fastify/cookie';

const CONCURRENCY_LEVELS = [1, 10, 50, 100, 250, 500];
const WARMUP_REQUESTS = 10;
const BENCHMARK_PREFIX = 'bench_p4_';

export interface EndpointMetric {
  endpoint: string;
  method: string;
  concurrency: number;
  attempted: number;
  successful: number;
  failed: number;
  throughputRps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  errorRatePercent: number;
  eventLoopLagP95Ms: number;
  rssMb: number;
  heapMb: number;
}

export interface BenchmarkReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpus: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
    nodeEnv: string;
  };
  metrics: EndpointMetric[];
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

export async function runMasterBenchmarkSuite(
  outputPath?: string,
): Promise<BenchmarkReport> {
  console.log('====================================================');
  console.log('   HAKIKU PHASE 4 MASTER BENCHMARK SUITE INITIATED   ');
  console.log('====================================================');

  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  await app.register(fastifyCookie as any, {
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
  const metricsService = app.get(MetricsService);

  // Total test entities needed
  const totalUserCount = 600;
  console.log(`[Provisioning] Creating ${totalUserCount} deterministic users, profiles & posts...`);

  const userIds: string[] = [];
  const userTokens: string[] = [];
  const userValues: (typeof users.$inferInsert)[] = [];
  const profileValues: (typeof profiles.$inferInsert)[] = [];

  const jwtIssuer = process.env.JWT_ISSUER || 'hakiku-api';
  const jwtAudience = process.env.JWT_AUDIENCE || 'hakiku-app';

  for (let i = 0; i < totalUserCount; i++) {
    const id = crypto.randomUUID();
    userIds.push(id);
    const email = `${BENCHMARK_PREFIX}${i}_${id.slice(-6)}@srmist.edu.in`;

    userValues.push({
      id,
      email,
      isVerified: true,
      role: 'STUDENT',
    });

    profileValues.push({
      userId: id,
      username: `${BENCHMARK_PREFIX}${i}_${id.slice(-6)}`,
      displayName: `Bench User ${i}`,
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2020,
      graduationYear: 2024,
    });

    const token = await jwtService.signAsync(
      { sub: id, email, role: 'STUDENT' },
      { issuer: jwtIssuer, audience: jwtAudience },
    );
    userTokens.push(token);
  }

  await db.insert(users).values(userValues).onConflictDoNothing();
  await db.insert(profiles).values(profileValues).onConflictDoNothing();

  // Create mutual connections & follow relations for user 0 & target user 1
  const targetUser0 = userIds[0];
  const targetUser1 = userIds[1];
  const token0 = userTokens[0];
  const token1 = userTokens[1];

  const [uA, uB] = targetUser0 < targetUser1 ? [targetUser0, targetUser1] : [targetUser1, targetUser0];
  await db.insert(connections).values({ userAId: uA, userBId: uB }).onConflictDoNothing();
  await db.insert(follows).values({ followerId: targetUser0, followingId: targetUser1 }).onConflictDoNothing();

  // Create posts for Feed & Like benchmark
  const postValues: (typeof posts.$inferInsert)[] = userIds.map((uid, idx) => ({
    id: crypto.randomUUID(),
    authorId: uid,
    content: `Benchmark Post Content ${idx} for Hakiku performance evaluation`,
    visibility: 'PUBLIC',
  }));
  await db.insert(posts).values(postValues).onConflictDoNothing();
  const samplePostId = postValues[0].id;

  // Create conversation & messages for Messaging & Cursor benchmark
  const [convo] = await db
    .insert(conversations)
    .values({ userAId: uA, userBId: uB })
    .onConflictDoNothing()
    .returning();

  const conversationId = convo?.id || (await db.select().from(conversations).where(sql`user_a_id = ${uA} AND user_b_id = ${uB}`).limit(1))[0].id;

  await db.insert(conversationParticipants).values([
    { conversationId, userId: targetUser0 },
    { conversationId, userId: targetUser1 },
  ]).onConflictDoNothing();

  // Seed 50 messages in conversation for retrieval and cursor testing
  const seededMessages: (typeof messages.$inferInsert)[] = [];
  let firstMsgId = '';
  for (let i = 0; i < 50; i++) {
    const msgId = crypto.randomUUID();
    if (i === 0) firstMsgId = msgId;
    seededMessages.push({
      id: msgId,
      conversationId,
      senderId: i % 2 === 0 ? targetUser0 : targetUser1,
      content: `Seeded message ${i}`,
      messageType: 'TEXT',
    });
  }
  await db.insert(messages).values(seededMessages).onConflictDoNothing();

  console.log('[Provisioning] Complete. Starting benchmark execution...\n');

  const reportMetrics: EndpointMetric[] = [];

  // Benchmarked Endpoints Config
  const scenarios = [
    {
      name: 'GET /feed',
      method: 'GET',
      getUrl: (i: number) => '/feed?page=1&limit=20',
      getHeaders: (i: number) => ({ authorization: `Bearer ${userTokens[i % totalUserCount]}` }),
      getPayload: () => undefined,
    },
    {
      name: 'POST /posts/:id/like',
      method: 'POST',
      getUrl: () => `/posts/${samplePostId}/like`,
      getHeaders: (i: number) => ({ authorization: `Bearer ${userTokens[i % totalUserCount]}` }),
      getPayload: () => undefined,
    },
    {
      name: 'POST /messages',
      method: 'POST',
      getUrl: () => `/messages/conversations/${conversationId}/messages`,
      getHeaders: () => ({ authorization: `Bearer ${token0}` }),
      getPayload: (i: number) => ({ content: `Benchmark message ${i}`, messageType: 'TEXT' }),
    },
    {
      name: 'GET /messages/conversations/:id/messages',
      method: 'GET',
      getUrl: () => `/messages/conversations/${conversationId}/messages?limit=20`,
      getHeaders: () => ({ authorization: `Bearer ${token0}` }),
      getPayload: () => undefined,
    },
    {
      name: 'GET /messages cursor sync',
      method: 'GET',
      getUrl: () => `/messages/conversations/${conversationId}/messages?afterId=${firstMsgId}`,
      getHeaders: () => ({ authorization: `Bearer ${token0}` }),
      getPayload: () => undefined,
    },
    {
      name: 'GET /notifications',
      method: 'GET',
      getUrl: () => '/notifications?limit=20',
      getHeaders: (i: number) => ({ authorization: `Bearer ${userTokens[i % totalUserCount]}` }),
      getPayload: () => undefined,
    },
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- BENCHMARK SCENARIO: ${scenario.name} ---`);

    // Warmup
    const warmupTasks = [];
    for (let w = 0; w < WARMUP_REQUESTS; w++) {
      warmupTasks.push(
        app.inject({
          method: scenario.method as any,
          url: scenario.getUrl(w),
          headers: scenario.getHeaders(w),
          payload: scenario.getPayload(w),
        }),
      );
    }
    await Promise.all(warmupTasks);

    for (const concurrency of CONCURRENCY_LEVELS) {
      const startTime = process.hrtime.bigint();
      const latencies = new Float64Array(concurrency);
      const requests = [];

      for (let c = 0; c < concurrency; c++) {
        const reqIdx = c;
        requests.push(
          (async () => {
            const reqStart = process.hrtime.bigint();
            const res = await app.inject({
              method: scenario.method as any,
              url: scenario.getUrl(reqIdx),
              headers: scenario.getHeaders(reqIdx),
              payload: scenario.getPayload(reqIdx),
            });
            const reqEnd = process.hrtime.bigint();
            latencies[reqIdx] = Number(reqEnd - reqStart) / 1_000_000;
            return res;
          })(),
        );
      }

      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();
      const totalElapsedMs = Number(endTime - startTime) / 1_000_000;

      let successful = 0;
      let failed = 0;

      for (const res of responses) {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successful++;
        } else {
          failed++;
        }
      }

      const rps = totalElapsedMs > 0 ? (successful / totalElapsedMs) * 1000 : 0;
      const sortedLatencies = Array.from(latencies).sort((a, b) => a - b);

      const p50 = calculatePercentile(sortedLatencies, 50);
      const p95 = calculatePercentile(sortedLatencies, 95);
      const p99 = calculatePercentile(sortedLatencies, 99);
      const max = sortedLatencies[sortedLatencies.length - 1];
      const errorRatePercent = concurrency > 0 ? (failed / concurrency) * 100 : 0;

      const mem = process.memoryUsage();
      const rssMb = Number((mem.rss / 1024 / 1024).toFixed(2));
      const heapMb = Number((mem.heapUsed / 1024 / 1024).toFixed(2));

      reportMetrics.push({
        endpoint: scenario.name,
        method: scenario.method,
        concurrency,
        attempted: concurrency,
        successful,
        failed,
        throughputRps: Number(rps.toFixed(1)),
        p50Ms: Number(p50.toFixed(1)),
        p95Ms: Number(p95.toFixed(1)),
        p99Ms: Number(p99.toFixed(1)),
        maxMs: Number(max.toFixed(1)),
        errorRatePercent: Number(errorRatePercent.toFixed(2)),
        eventLoopLagP95Ms: Number(metricsService.currentMetrics.p95Lag),
        rssMb,
        heapMb,
      });

      console.log(
        `Conc: ${concurrency.toString().padStart(3)} | Success: ${successful.toString().padStart(3)}/${concurrency} | ` +
          `Req/s: ${rps.toFixed(1).padStart(7)} | p50: ${p50.toFixed(1).padStart(5)}ms | ` +
          `p95: ${p95.toFixed(1).padStart(5)}ms | p99: ${p99.toFixed(1).padStart(5)}ms`,
      );
    }
  }

  await app.close();

  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemoryMb: Number((os.totalmem() / 1024 / 1024).toFixed(2)),
      freeMemoryMb: Number((os.freemem() / 1024 / 1024).toFixed(2)),
      nodeEnv: process.env.NODE_ENV || 'test',
    },
    metrics: reportMetrics,
  };

  const targetFile = outputPath || path.join(__dirname, 'phase4-baseline.json');
  fs.writeFileSync(targetFile, JSON.stringify(report, null, 2));
  console.log(`\n====================================================`);
  console.log(`Benchmark Report Saved to: ${targetFile}`);
  console.log(`====================================================\n`);

  return report;
}

if (require.main === module) {
  runMasterBenchmarkSuite().catch((err) => {
    console.error('Master benchmark suite failed:', err);
    process.exit(1);
  });
}
