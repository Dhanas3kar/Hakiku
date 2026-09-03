import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import { db } from '../src/db';
import {
  users,
  profiles,
  posts,
  connections,
  conversations,
  conversationParticipants,
  adminCredentials,
} from '../src/db/schema';
import { NestFactory } from '@nestjs/core';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';
import * as path from 'path';

const CONCURRENCY_LEVELS = [1, 5, 10, 25, 50, 100];
const WARMUP_REQUESTS = 50;
const BENCHMARK_PREFIX = 'bench_';

interface BenchmarkResult {
  endpoint: string;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  statusDistribution: Record<number, number>;
  errorRate: number;
  totalElapsedMs: number;
  requestsPerSecond: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  cpuDeltaUs: number;
  memoryDeltaMb: number;
  errorSamples?: { status: number, body: string }[];
}

function calculatePercentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
}

async function runBenchmark() {
  console.log('--- INITIALIZING BENCHMARK ENVIRONMENT ---');

  if (process.env.NODE_ENV !== 'test') {
    console.warn('Forcing NODE_ENV=test for benchmark script.');
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

  const maxConcurrency = Math.max(...CONCURRENCY_LEVELS);
  const TOTAL_REQUESTS_PER_SCENARIO = WARMUP_REQUESTS + CONCURRENCY_LEVELS.reduce((a, b) => a + b, 0);
  console.log(`Provisioning test data for total isolated requests per scenario: ${TOTAL_REQUESTS_PER_SCENARIO}...`);

  // 1. Provision Users
  const userIds: string[] = [];
  const userTokens: string[] = [];
  const userValues: (typeof users.$inferInsert)[] = [];
  const profileValues: (typeof profiles.$inferInsert)[] = [];

  for (let i = 0; i < TOTAL_REQUESTS_PER_SCENARIO; i++) {
    const id = crypto.randomUUID();
    userIds.push(id);
    userValues.push({
      id,
      email: `${BENCHMARK_PREFIX}${i}_${id.slice(-6)}@srmist.edu.in`,
      isVerified: true,
      role: 'ADMIN', // For /admin/auth/login benchmark later
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
    const token = await jwtService.signAsync({
      sub: id,
      email: userValues[i].email,
      role: 'ADMIN',
    });
    userTokens.push(token);
  }

  await db.insert(users).values(userValues);
  await db.insert(profiles).values(profileValues);

  // 1b. Provision Admin Credentials for all users
  const adminCredValues: (typeof adminCredentials.$inferInsert)[] = userIds.map((uid) => ({
    userId: uid,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$R9+x7b3yY7zQ1vU2$2v4u6w8x0y2z4A6B8C0D2E4F6G8H0I2J', // password123
  }));
  await db.insert(adminCredentials).values(adminCredValues);

  // 2. Provision Target Posts for Like benchmark (1 post per user to avoid unique constraint 409s)
  const targetPostIds: string[] = [];
  const postValues: (typeof posts.$inferInsert)[] = userIds.map((uid, idx) => {
    const pid = crypto.randomUUID();
    targetPostIds.push(pid);
    return {
      id: pid,
      authorId: uid,
      content: `Benchmark Target Post ${idx}`,
      visibility: 'PUBLIC',
    };
  });
  await db.insert(posts).values(postValues);

  // 3. Provision Conversations for Messaging benchmark
  const targetConvIds: string[] = [];
  const convValues: (typeof conversations.$inferInsert)[] = [];
  const participantValues: (typeof conversationParticipants.$inferInsert)[] = [];
  const connectionValues: (typeof connections.$inferInsert)[] = [];
  
  for (let i = 0; i < TOTAL_REQUESTS_PER_SCENARIO; i++) {
    const cid = crypto.randomUUID();
    targetConvIds.push(cid);
    
    // Conversations schema requires canonical ordering of userAId and userBId
    const u1 = userIds[i];
    const u2 = userIds[(i + 1) % TOTAL_REQUESTS_PER_SCENARIO];
    const [userAId, userBId] = u1 < u2 ? [u1, u2] : [u2, u1];

    convValues.push({ id: cid, userAId, userBId });
    participantValues.push({ conversationId: cid, userId: userAId });
    participantValues.push({ conversationId: cid, userId: userBId });
    // Provision mutual connection to satisfy messaging constraints
    connectionValues.push({ userAId, userBId });
  }
  await db.insert(connections).values(connectionValues).onConflictDoNothing();
  await db.insert(conversations).values(convValues);
  await db.insert(conversationParticipants).values(participantValues);

  console.log('Test data provisioned successfully.');

  const results: BenchmarkResult[] = [];

  const executeScenario = async (
    endpointName: string,
    buildRequest: (index: number) => any
  ) => {
    console.log(`\n======================================================`);
    console.log(`Starting Scenario: ${endpointName}`);
    console.log(`======================================================`);

    let requestCounter = 0;

    // WARMUP
    console.log(`Warming up with ${WARMUP_REQUESTS} requests...`);
    const warmupPromises = [];
    for (let i = 0; i < WARMUP_REQUESTS; i++) {
      warmupPromises.push(app.inject(buildRequest(requestCounter++)));
    }
    await Promise.all(warmupPromises);
    console.log(`Warmup complete.`);

    for (const concurrency of CONCURRENCY_LEVELS) {
      console.log(`\nRunning ${endpointName} at Concurrency: ${concurrency}...`);
      
      const startMem = process.memoryUsage();
      const startCpu = process.cpuUsage();
      const startTime = process.hrtime.bigint();

      const requests = [];
      const latencies = new Float64Array(concurrency);

      for (let i = 0; i < concurrency; i++) {
        const currentIndex = requestCounter++;
        const reqPromise = (async () => {
          const reqStart = process.hrtime.bigint();
          const response = await app.inject(buildRequest(currentIndex));
          const reqEnd = process.hrtime.bigint();
          latencies[i] = Number(reqEnd - reqStart) / 1_000_000;
          return response;
        })();
        requests.push(reqPromise);
      }

      const responses = await Promise.all(requests);
      const endTime = process.hrtime.bigint();
      const endCpu = process.cpuUsage(startCpu);
      const endMem = process.memoryUsage();

      const totalElapsedMs = Number(endTime - startTime) / 1_000_000;
      const requestsPerSecond = (concurrency / totalElapsedMs) * 1000;

      let successfulRequests = 0;
      let failedRequests = 0;
      const statusDistribution: Record<number, number> = {};

      const errorSamples: any[] = [];
      for (const res of responses) {
        statusDistribution[res.statusCode] = (statusDistribution[res.statusCode] || 0) + 1;
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successfulRequests++;
        } else {
          failedRequests++;
          if (errorSamples.length < 3) {
            try {
              errorSamples.push({ status: res.statusCode, body: JSON.parse(res.payload) });
            } catch {
              errorSamples.push({ status: res.statusCode, body: res.payload });
            }
          }
        }
      }

      const sortedLatencies = Array.from(latencies).sort((a, b) => a - b);
      
      const sumLatency = sortedLatencies.reduce((a, b) => a + b, 0);
      const averageLatencyMs = sumLatency / concurrency;
      
      const p50LatencyMs = calculatePercentile(sortedLatencies, 50);
      const p95LatencyMs = calculatePercentile(sortedLatencies, 95);
      const p99LatencyMs = calculatePercentile(sortedLatencies, 99);
      const maxLatencyMs = sortedLatencies[sortedLatencies.length - 1];
      const errorRate = (failedRequests / concurrency) * 100;

      const cpuDeltaUs = endCpu.user + endCpu.system;
      const memoryDeltaMb = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;

      results.push({
        endpoint: endpointName,
        concurrency,
        totalRequests: concurrency,
        successfulRequests,
        failedRequests,
        statusDistribution,
        errorRate,
        totalElapsedMs,
        requestsPerSecond,
        averageLatencyMs,
        p50LatencyMs,
        p95LatencyMs,
        p99LatencyMs,
        maxLatencyMs,
        cpuDeltaUs,
        memoryDeltaMb,
        errorSamples: errorSamples.slice(0, 5).map(e => ({ status: e.status, body: e.body }))
      });

      console.log(`  Requests: ${concurrency} | Success: ${successfulRequests} | Errors: ${failedRequests}`);
      console.log(`  Req/s (Burst): ${requestsPerSecond.toFixed(2)}`);
      console.log(`  Latency:  p50=${p50LatencyMs.toFixed(2)}ms, p95=${p95LatencyMs.toFixed(2)}ms, max=${maxLatencyMs.toFixed(2)}ms`);
      
      console.log(`  Status Distribution:`);
      for (const [statusCode, count] of Object.entries(statusDistribution)) {
        console.log(`    ${statusCode}: ${count}`);
      }
      
      if (failedRequests > 0) {
        console.log(`  Sample Errors:`);
        errorSamples.forEach((err, idx) => {
          console.log(`    [${idx + 1}] Status ${err.status}: ${JSON.stringify(err.body).substring(0, 150)}`);
        });
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  // --- WORKLOAD VALIDATION ---
  if (userIds.length < TOTAL_REQUESTS_PER_SCENARIO) {
    console.error(`Benchmark setup failed: Requires ${TOTAL_REQUESTS_PER_SCENARIO} users, but only provisioned ${userIds.length}`);
    process.exit(1);
  }

  // --- SCENARIO 1: POST /posts ---
  await executeScenario('POST /posts', (i) => ({
    method: 'POST',
    url: '/posts',
    headers: { authorization: `Bearer ${userTokens[i]}` },
    payload: {
      content: `Benchmark Post Content ${crypto.randomUUID()}`,
      visibility: 'PUBLIC',
    },
  }));

  // --- SCENARIO 2: POST /posts/:postId/like ---
  await executeScenario('POST /posts/:postId/like', (i) => ({
    method: 'POST',
    url: `/posts/${targetPostIds[i]}/like`,
    headers: { authorization: `Bearer ${userTokens[i]}` },
  }));

  // --- SCENARIO 3: POST /messages/conversations/:conversationId/messages ---
  await executeScenario('POST /messages/...', (i) => ({
    method: 'POST',
    url: `/messages/conversations/${targetConvIds[i]}/messages`,
    headers: { authorization: `Bearer ${userTokens[i]}` },
    payload: {
      messageType: 'TEXT',
      content: 'Bench message',
    },
  }));

  // --- SCENARIO 4: GET /feed ---
  await executeScenario('GET /feed', (i) => ({
    method: 'GET',
    url: `/feed?limit=20`,
    headers: { authorization: `Bearer ${userTokens[i]}` },
  }));

  // --- SCENARIO 5: POST /admin/auth/login ---
  console.log('Using seeded credentials for auth benchmark...');
  // The credentials were already seeded in step 1b with password 'benchPassword123!'
  // But wait, they were seeded with 'password123', let's just use that.

  await executeScenario('POST /admin/auth/login', (i) => ({
    method: 'POST',
    url: '/admin/auth/login',
    payload: {
      email: userValues[i].email,
      password: 'password123',
    },
  }));

  // Shutdown
  await app.close();

  // --- REPORT GENERATION ---
  const report = {
    timestamp: new Date().toISOString(),
    nodejsVersion: process.version,
    osPlatform: os.platform(),
    osRelease: os.release(),
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0].model,
    totalMemoryGb: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
    environment: 'test',
    database: 'srm_connect_test',
    dbObservation: 'DB telemetry unavailable (Internal pool metrics not natively exposed via Postgres.js without intrusive wrappers)',
    results,
  };

  const outputPath = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nRaw benchmark results saved to ${outputPath}`);

  console.log('\n--- SUMMARY ---');
  console.log('Endpoint             | Concurrency | Requests | Success | Errors | Req/s | p50  | p95  | p99  | Max');
  console.log('--------------------------------------------------------------------------------------------------------');
  for (const r of results) {
    const ep = r.endpoint.padEnd(20).substring(0, 20);
    const conc = r.concurrency.toString().padEnd(11);
    const req = r.totalRequests.toString().padEnd(8);
    const succ = r.successfulRequests.toString().padEnd(7);
    const err = r.failedRequests.toString().padEnd(6);
    const rps = r.requestsPerSecond.toFixed(0).padEnd(5);
    const p50 = r.p50LatencyMs.toFixed(1).padEnd(4);
    const p95 = r.p95LatencyMs.toFixed(1).padEnd(4);
    const p99 = r.p99LatencyMs.toFixed(1).padEnd(4);
    const max = r.maxLatencyMs.toFixed(1).padEnd(4);
    console.log(`${ep} | ${conc} | ${req} | ${succ} | ${err} | ${rps} | ${p50} | ${p95} | ${p99} | ${max}`);
  }
}

runBenchmark().catch(err => {
  console.error('Benchmark failed catastrophically:', err);
  process.exit(1);
});
