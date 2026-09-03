import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from '../src/filters/global-exception.filter';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { db } from '../src/db';
import {
  users,
  profiles,
  connections,
  posts,
  postLikes,
  follows,
  connectionRequests,
  notificationOutbox,
  notifications,
} from '../src/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { NotificationWorkerService } from '../src/notifications/services/notification-worker.service';

describe('High Concurrency & Stress Verification (e2e)', () => {
  jest.setTimeout(60000);

  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let workerService: NotificationWorkerService;

  let targetUserId: string;
  let targetPostId: string;
  let userIds: string[] = [];
  let userTokens: string[] = [];

  beforeAll(async () => {
    await db.execute(
      sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id varchar(255);`,
    );
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications (event_id);`,
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

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

    jwtService = app.get(JwtService);
    workerService = app.get(NotificationWorkerService);



    // Create target user with unique tag
    const uniqueTag = crypto.randomUUID().slice(-8);
    const [tUser] = await db
      .insert(users)
      .values({ email: `target_conc_${uniqueTag}@srmist.edu.in`, isVerified: true })
      .returning();
    targetUserId = tUser.id;

    await db.insert(profiles).values({
      userId: targetUserId,
      username: `target_conc_${uniqueTag}`,
      displayName: 'Target User',
      campus: 'KTR',
      department: 'CSE',
      degreeProgram: 'B.Tech',
      batchYear: 2020,
      graduationYear: 2024,
    });

    // Create target post
    const [tPost] = await db
      .insert(posts)
      .values({
        authorId: targetUserId,
        content: 'High Concurrency Test Target Post',
        visibility: 'PUBLIC',
      })
      .returning();
    targetPostId = tPost.id;

    // Create 100 concurrent test users for stress testing
    const userValues = [];
    const profileValues = [];

    for (let i = 0; i < 100; i++) {
      const id = crypto.randomUUID();
      userIds.push(id);
      const email = `conc_user_${i}_${id.slice(-6)}@srmist.edu.in`;

      userValues.push({
        id,
        email,
        isVerified: true,
      });

      profileValues.push({
        userId: id,
        username: `conc_usr_${i}_${id.slice(-6)}`,
        displayName: `Conc User ${i}`,
        campus: 'KTR',
        department: 'CSE',
        degreeProgram: 'B.Tech',
        batchYear: 2020,
        graduationYear: 2024,
      });
    }

    await db.insert(users).values(userValues);
    await db.insert(profiles).values(profileValues);

    // Sign JWT tokens for all 100 users
    for (let i = 0; i < 100; i++) {
      const token = await jwtService.signAsync({
        sub: userIds[i],
        email: userValues[i].email,
        role: 'STUDENT',
      });
      userTokens.push(token);
    }
  }, 30000);

  afterAll(async () => {
    // Cleanup 100 users & target user
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, [...userIds, targetUserId]));
    }
    await app.close();
  });

  describe('1. Concurrency: 100 Simultaneous Post Likes', () => {
    it('100 concurrent users liking the same post -> 100 likes created, likes_count = 100', async () => {
      const requests = userTokens.map((token) =>
        app.inject({
          method: 'POST',
          url: `/posts/${targetPostId}/like`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );

      const responses = await Promise.all(requests);

      // Verify all 100 returned success (200 OK)
      responses.forEach((res) => {
        expect(res.statusCode).toBe(200);
      });

      // Verify physical DB count in post_likes
      const dbLikes = await db
        .select()
        .from(postLikes)
        .where(eq(postLikes.postId, targetPostId));
      expect(dbLikes.length).toBe(100);

      // Verify atomic likes_count on posts table
      const [updatedPost] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, targetPostId));
      expect(updatedPost.likesCount).toBe(100);
    });

    it('50 duplicate concurrent likes from the SAME user -> 1 succeeds (200), 49 return 409, likes_count = 1', async () => {
      const singleUserToken = userTokens[0];

      // Reset target post likes for single user testing
      const [postForDup] = await db
        .insert(posts)
        .values({
          authorId: targetUserId,
          content: 'Duplicate Likes Target Post',
          visibility: 'PUBLIC',
        })
        .returning();

      const dupRequests = Array.from({ length: 50 }, () =>
        app.inject({
          method: 'POST',
          url: `/posts/${postForDup.id}/like`,
          headers: { authorization: `Bearer ${singleUserToken}` },
        }),
      );

      const responses = await Promise.all(dupRequests);

      const successCount = responses.filter((r) => r.statusCode === 200).length;
      const conflictCount = responses.filter((r) => r.statusCode === 409).length;

      if (successCount !== 1) {
        console.log('Failing statuses:', responses.map(r => r.statusCode).reduce((acc, code) => {
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        }, {}));
        const failedResponse = responses.find(r => r.statusCode !== 409 && r.statusCode !== 200);
        if (failedResponse) console.log('Failed body:', failedResponse.body);
      }

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(49);

      const dbLikes = await db
        .select()
        .from(postLikes)
        .where(eq(postLikes.postId, postForDup.id));
      expect(dbLikes.length).toBe(1);

      const [postRow] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postForDup.id));
      expect(postRow.likesCount).toBe(1);
    });

    it('100 duplicate concurrent likes from the SAME user -> 1 succeeds (200), 99 return 409, likes_count = 1', async () => {
      const singleUserToken = userTokens[0];

      const [postForDup] = await db
        .insert(posts)
        .values({
          authorId: targetUserId,
          content: '100 Duplicate Likes Target Post',
          visibility: 'PUBLIC',
        })
        .returning();

      const dupRequests = Array.from({ length: 100 }, () =>
        app.inject({
          method: 'POST',
          url: `/posts/${postForDup.id}/like`,
          headers: { authorization: `Bearer ${singleUserToken}` },
        }),
      );

      const responses = await Promise.all(dupRequests);

      const successCount = responses.filter((r) => r.statusCode === 200).length;
      const conflictCount = responses.filter((r) => r.statusCode === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(99);

      const dbLikes = await db
        .select()
        .from(postLikes)
        .where(eq(postLikes.postId, postForDup.id));
      expect(dbLikes.length).toBe(1);

      const [postRow] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postForDup.id));
      expect(postRow.likesCount).toBe(1);
    });

    it('Rapid like -> unlike -> like -> creates distinct outbox events without collision', async () => {
      const singleUserToken = userTokens[0];
      const singleUserId = userIds[0];

      const [postForRapid] = await db
        .insert(posts)
        .values({
          authorId: targetUserId,
          content: 'Rapid Like Target Post',
          visibility: 'PUBLIC',
        })
        .returning();

      const res1 = await app.inject({
        method: 'POST',
        url: `/posts/${postForRapid.id}/like`,
        headers: { authorization: `Bearer ${singleUserToken}` },
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: 'DELETE',
        url: `/posts/${postForRapid.id}/like`,
        headers: { authorization: `Bearer ${singleUserToken}` },
      });
      expect(res2.statusCode).toBe(200);

      const res3 = await app.inject({
        method: 'POST',
        url: `/posts/${postForRapid.id}/like`,
        headers: { authorization: `Bearer ${singleUserToken}` },
      });
      expect(res3.statusCode).toBe(200);

      const outboxEvents = await db
        .select()
        .from(notificationOutbox)
        .where(sql`payload->>'entityId' = ${postForRapid.id} AND payload->>'actorId' = ${singleUserId}`);
      
      expect(outboxEvents.length).toBe(2);
      expect(outboxEvents[0].eventId).not.toEqual(outboxEvents[1].eventId);
    });
  });

  describe('2. Concurrency: 100 Simultaneous Follow Requests', () => {
    it('100 concurrent users following the target user -> 100 follows created in DB', async () => {
      const requests = userTokens.map((token) =>
        app.inject({
          method: 'POST',
          url: `/networking/follow/${targetUserId}`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.statusCode).toBe(201);
      });

      const dbFollows = await db
        .select()
        .from(follows)
        .where(eq(follows.followingId, targetUserId));
      expect(dbFollows.length).toBe(100);
    });
  });

  describe('3. Concurrency: 20 Simultaneous Connection Requests', () => {
    it('20 concurrent users requesting connection with target user -> 20 requests created, 0 duplicates', async () => {
      const selectedTokens = userTokens.slice(0, 20);

      const requests = selectedTokens.map((token) =>
        app.inject({
          method: 'POST',
          url: `/networking/connections/request/${targetUserId}`,
          headers: { authorization: `Bearer ${token}` },
        }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.statusCode).toBe(200);
      });

      const dbConnReqs = await db
        .select()
        .from(connectionRequests)
        .where(eq(connectionRequests.receiverId, targetUserId));
      expect(dbConnReqs.length).toBe(20);
    });
  });

  describe('4. Concurrency: Multi-Worker Outbox Event Processing', () => {
    it('5 concurrent workers processing 10 outbox events -> exactly 10 notifications created, 0 duplicates', async () => {
      // Ensure target user exists in database
      const [existingTarget] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (!existingTarget) {
        await db
          .insert(users)
          .values({ id: targetUserId, email: `target_fix_${Date.now()}@srmist.edu.in`, isVerified: true })
          .onConflictDoNothing();
      }

      const outboxEventIds: string[] = [];

      for (let i = 0; i < 10; i++) {
        const actorId = userIds[i];
        const [existingActor] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);
        if (!existingActor) {
          await db
            .insert(users)
            .values({ id: actorId, email: `actor_fix_${i}_${Date.now()}@srmist.edu.in`, isVerified: true })
            .onConflictDoNothing();
        }

        const eventId = `EVT_CONC_WORKER_${i}_${crypto.randomUUID()}`;
        outboxEventIds.push(eventId);

        await db.insert(notificationOutbox).values({
          eventId,
          type: 'POST_LIKE',
          payload: {
            recipientId: targetUserId,
            actorId: actorId,
            entityType: 'POST',
            entityId: targetPostId,
          },
          status: 'PENDING',
          attempts: 0,
        });
      }

      // Launch 5 workers concurrently to process outbox
      const workerRuns = Array.from({ length: 5 }, () =>
        (workerService as any).processOutbox(),
      );

      await Promise.all(workerRuns);

      // Verify all 10 outbox events are PROCESSED
      const processedOutbox = await db
        .select()
        .from(notificationOutbox)
        .where(inArray(notificationOutbox.eventId, outboxEventIds));

      expect(processedOutbox.length).toBe(10);
      processedOutbox.forEach((row) => {
        expect(row.status).toBe('PROCESSED');
      });

      // Verify exactly 10 notifications created (no duplicates)
      const createdNotifs = await db
        .select()
        .from(notifications)
        .where(inArray(notifications.eventId, outboxEventIds));

      expect(createdNotifs.length).toBe(10);
    });
  });
});
