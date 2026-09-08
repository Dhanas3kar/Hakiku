import 'dotenv/config';
import { IncomingMessage } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// Trigger NestJS reload - Collaboration controller compilation errors resolved
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
import { users, profiles, adminCredentials } from './db/schema';
import { sql, eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

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

  // Enable graceful NestJS lifecycle shutdown hooks (SIGTERM/SIGINT)
  app.enableShutdownHooks();

  // Automatic schema migrations check on startup
  try {
    console.log('[STARTUP MIGRATION] Ensuring required database tables and columns exist...');
    await db.execute(sql`
      ALTER TABLE polls ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
      CREATE TABLE IF NOT EXISTS hot_takes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "date" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "place" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "time" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "media" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "other_details" TEXT;
      CREATE INDEX IF NOT EXISTS idx_hot_takes_author_created ON hot_takes(author_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_hot_takes_created_at ON hot_takes(created_at);
      CREATE INDEX IF NOT EXISTS idx_polls_post_id ON polls(post_id);
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (comment_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
      CREATE TABLE IF NOT EXISTS admin_credentials (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Communities Tables
      CREATE TABLE IF NOT EXISTS communities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visibility VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) NOT NULL DEFAULT 'PUBLIC';
      ALTER TABLE communities ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'General';

      CREATE TABLE IF NOT EXISTS community_members (
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (community_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS community_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
        description TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_private BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS community_bans (
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        banned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (community_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS community_moderation_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS community_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        deleted_at TIMESTAMP,
        deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_community_messages_chan_created ON community_messages(channel_id, created_at);

      -- Hackathons & Hackathon Teams Tables
      CREATE TABLE IF NOT EXISTS hackathons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(100) NOT NULL DEFAULT 'MANUAL',
        external_id VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        organizer VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        registration_deadline TIMESTAMP,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        mode VARCHAR(50) NOT NULL DEFAULT 'ONLINE',
        location VARCHAR(255),
        themes JSONB DEFAULT '[]'::jsonb,
        skills JSONB DEFAULT '[]'::jsonb,
        prize_info TEXT,
        canonical_status VARCHAR(50) NOT NULL DEFAULT 'UPCOMING',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS provider VARCHAR(100) NOT NULL DEFAULT 'MANUAL';
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMP;
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS location VARCHAR(255);
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS themes JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS prize_info TEXT;
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS canonical_status VARCHAR(50) DEFAULT 'UPCOMING';
      ALTER TABLE hackathons ALTER COLUMN start_date DROP NOT NULL;
      ALTER TABLE hackathons ALTER COLUMN end_date DROP NOT NULL;
      ALTER TABLE hackathons ALTER COLUMN description DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS hackathon_sync_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(100) NOT NULL DEFAULT 'PUBLIC_API',
        status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
        items_processed INTEGER NOT NULL DEFAULT 0,
        items_created INTEGER NOT NULL DEFAULT 0,
        items_updated INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      ALTER TABLE hackathon_sync_runs ADD COLUMN IF NOT EXISTS provider VARCHAR(100) DEFAULT 'PUBLIC_API';
      ALTER TABLE hackathon_sync_runs ADD COLUMN IF NOT EXISTS items_processed INTEGER DEFAULT 0;
      ALTER TABLE hackathon_sync_runs ADD COLUMN IF NOT EXISTS items_created INTEGER DEFAULT 0;
      ALTER TABLE hackathon_sync_runs ADD COLUMN IF NOT EXISTS items_updated INTEGER DEFAULT 0;
      ALTER TABLE hackathon_sync_runs ADD COLUMN IF NOT EXISTS error_message TEXT;
      DO $$ BEGIN
        ALTER TABLE hackathon_sync_runs ALTER COLUMN source DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN END $$;

      CREATE TABLE IF NOT EXISTS hackathon_teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        tagline VARCHAR(255),
        description TEXT,
        looking_for TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        max_members INTEGER NOT NULL DEFAULT 4,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE hackathon_teams ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE hackathon_teams ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 4;
      DO $$ BEGIN
        ALTER TABLE hackathon_teams ALTER COLUMN leader_id DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN END $$;

      CREATE TABLE IF NOT EXISTS hackathon_team_members (
        team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (team_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS hackathon_team_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
        role_name VARCHAR(100) NOT NULL,
        description TEXT,
        is_filled BOOLEAN NOT NULL DEFAULT false,
        filled_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS team_join_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
        applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_role_id UUID REFERENCES hackathon_team_roles(id) ON DELETE SET NULL,
        message TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS team_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
        inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_role_id UUID REFERENCES hackathon_team_roles(id) ON DELETE SET NULL,
        message TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Collaboration & Student Intelligence Tables
      CREATE TABLE IF NOT EXISTS blocks (
        blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (blocker_id, blocked_id)
      );

      CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        category VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS interests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        category VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS skill_aliases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alias VARCHAR(50) NOT NULL,
        normalized_alias VARCHAR(50) NOT NULL UNIQUE,
        canonical_skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_skills (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, skill_id)
      );

      CREATE TABLE IF NOT EXISTS user_interests (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, interest_id)
      );

      DO $$ BEGIN
        CREATE TYPE collaboration_intent AS ENUM ('LOOKING_FOR_TEAMMATES', 'OPEN_TO_COLLABORATION', 'JUST_EXPLORING');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE availability AS ENUM ('WEEKDAYS', 'WEEKENDS', 'FLEXIBLE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE collaboration_request_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS collaboration_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        intent collaboration_intent NOT NULL DEFAULT 'OPEN_TO_COLLABORATION',
        availability availability NOT NULL DEFAULT 'FLEXIBLE',
        looking_for_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
        preferred_hackathon_themes JSONB NOT NULL DEFAULT '[]'::jsonb,
        bio TEXT,
        is_discoverable BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS collaboration_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        status collaboration_request_status NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      ALTER TABLE hackathon_team_roles ADD COLUMN IF NOT EXISTS role_category VARCHAR(50) DEFAULT 'OTHER';
      ALTER TABLE hackathon_team_roles ADD COLUMN IF NOT EXISTS title VARCHAR(100) DEFAULT 'Teammate';
      ALTER TABLE hackathon_team_roles ADD COLUMN IF NOT EXISTS filled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE hackathons ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('[STARTUP MIGRATION] Schema migration check completed successfully.');
  } catch (err) {
    console.error('[STARTUP MIGRATION] Failed to apply schema migrations:', err);
  }

  // Automatic startup cleanup for any legacy 'hakikuadmin' handle (case-insensitive) to enforce single @hakiku_official admin handle
  try {
    const legacyProfiles = await db.execute(sql`
      SELECT id, user_id, username FROM profiles WHERE LOWER(username) LIKE '%hakikuadmin%' OR LOWER(username) = 'hakikuadmin'
    `);
    
    const rows = (legacyProfiles as any).rows || legacyProfiles;
    if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows as any[]) {
        const pId = row.id;
        const uId = row.user_id;
        if (!uId) continue;
        console.log(`[CLEANUP] Purging legacy admin profile: ${row.username} (${uId})...`);
        
        try { await db.execute(sql`DELETE FROM comments WHERE author_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM post_likes WHERE user_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM posts WHERE author_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM connections WHERE user_a_id = ${uId} OR user_b_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM connection_requests WHERE sender_id = ${uId} OR receiver_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM follows WHERE follower_id = ${uId} OR following_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM notifications WHERE recipient_id = ${uId} OR actor_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM messages WHERE sender_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM conversation_participants WHERE user_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM admin_credentials WHERE user_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM profiles WHERE id = ${pId} OR user_id = ${uId}`) } catch (_) {}
        try { await db.execute(sql`DELETE FROM users WHERE id = ${uId}`) } catch (_) {}
        console.log(`[CLEANUP] Deleted legacy admin profile: ${row.username}`);
      }
    }
  } catch (cleanupErr) {
    console.error('[CLEANUP] Legacy admin cleanup error:', cleanupErr);
  }

  // Automatic startup provisioning for official HAKIKU Admin user & credentials
  try {
    const adminEmail = (process.env.HAKIKU_ADMIN_EMAIL || 'admin@hakiku.com').trim().toLowerCase();
    const adminPassword = process.env.HAKIKU_ADMIN_PASSWORD || 'Admin@Hakiku';

    const userList = await db.select().from(users).where(eq(users.email, adminEmail));
    let adminUser: typeof users.$inferSelect;

    if (userList.length === 0) {
      const [newUser] = await db.insert(users).values({
        id: uuidv4(),
        email: adminEmail,
        isVerified: true,
        emailVerifiedAt: new Date(),
        role: 'ADMIN',
        status: 'ACTIVE',
      }).returning();
      adminUser = newUser;
    } else {
      const [updatedUser] = await db.update(users).set({
        role: 'ADMIN',
        isVerified: true,
        status: 'ACTIVE',
      }).where(eq(users.id, userList[0].id)).returning();
      adminUser = updatedUser;
    }

    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id as 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await db.insert(adminCredentials).values({
      userId: adminUser.id,
      passwordHash,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: adminCredentials.userId,
      set: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    const existingProfiles = await db.select().from(profiles).where(eq(profiles.userId, adminUser.id));
    if (existingProfiles.length === 0) {
      const existingByUsername = await db.select().from(profiles).where(eq(profiles.username, 'hakiku_official'));
      if (existingByUsername.length > 0) {
        await db.update(profiles).set({
          userId: adminUser.id,
          displayName: 'HAKIKU Official',
          isVerifiedIdentity: true,
        }).where(eq(profiles.id, existingByUsername[0].id));
      } else {
        await db.insert(profiles).values({
          id: uuidv4(),
          userId: adminUser.id,
          username: 'hakiku_official',
          displayName: 'HAKIKU Official',
          campus: 'SYSTEM',
          department: 'ADMINISTRATION',
          degreeProgram: 'SYSTEM',
          batchYear: 2024,
          graduationYear: 2028,
          isVerifiedIdentity: true,
          isProfileCompleted: true,
          completionPercentage: 100,
          visibility: 'PUBLIC',
        });
      }
    } else {
      await db.update(profiles).set({
        username: 'hakiku_official',
        displayName: 'HAKIKU Official',
        isVerifiedIdentity: true,
      }).where(eq(profiles.id, existingProfiles[0].id));
    }

    console.log(`[PROVISION] Official Admin account (${adminEmail}) provisioned/verified on startup.`);
  } catch (adminErr) {
    console.error('[PROVISION] Failed to provision admin user on startup:', adminErr);
  }

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
    const url = req.url || '';
    const isAuthRoute = url.startsWith('/admin/auth/') || url.startsWith('/auth/send-otp') || url.startsWith('/auth/verify-otp') || url.startsWith('/auth/refresh');
    const isAdminApiRoute = url.startsWith('/admin/');
    if (stateChangingMethods.includes(req.method) && !isAuthRoute && !isAdminApiRoute) {
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
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.CORS_ALLOWED_ORIGINS) {
        const origins = process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
        if (origins.includes(origin)) return callback(null, true);
      }
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        return callback(null, true);
      }
      if (
        process.env.NODE_ENV !== 'production' ||
        /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):3000$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  (fastifyInstance as any).addContentTypeParser(
    '*',
    { parseAs: 'buffer' },
    (_req: any, payload: any, done: any) => {
      done(null, payload);
    },
  );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
// Force NestJS watch server route map update for channel messages endpoint fix

