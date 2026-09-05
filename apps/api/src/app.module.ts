import { Module, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { NetworkingModule } from './networking/networking.module';
import { ProfileModule } from './profile/profile.module';
import { PostsModule } from './posts/posts.module';
import { FeedModule } from './feed/feed.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagingModule } from './messaging/messaging.module';
import { CommunityModule } from './community/community.module';
import { RedisModule } from './redis/redis.module';
import { AdminModule } from './admin/admin.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { HealthModule } from './health/health.module';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly appLogger = new Logger(AppThrottlerGuard.name);

  protected async handleRequest(requestProps: any): Promise<boolean> {
    const isRateLimitEnabled =
      process.env.ENABLE_RATE_LIMIT === 'true' ||
      process.env.TEST_ENABLE_RATE_LIMIT === 'true';

    if (process.env.NODE_ENV !== 'production' && !isRateLimitEnabled) {
      return true;
    }

    try {
      return await super.handleRequest(requestProps);
    } catch (err: any) {
      if (
        (err.status === 429 || err.statusCode === 429 || err.name === 'ThrottlerException') &&
        !err.message?.includes('Redis')
      ) {
        throw err;
      }

      this.appLogger.error(`Throttler storage error: ${err.message}`, err.stack);

      const req = requestProps.context.switchToHttp().getRequest();
      const path = req.routeOptions?.url || req.url || '';

      const isSecurityCritical = path.includes('/auth') || path.includes('/admin');

      if (isSecurityCritical) {
        throw new ServiceUnavailableException('Authentication services are temporarily unavailable.');
      }

      return true;
    }
  }
}

import { OnModuleInit } from '@nestjs/common';
import { db } from './db';
import { sql } from 'drizzle-orm';

@Module({
  imports: [
    RedisModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    NetworkingModule,
    ProfileModule,
    PostsModule,
    FeedModule,
    NotificationsModule,
    MessagingModule,
    CommunityModule,
    AdminModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: process.env.NODE_ENV === 'production' ? [
          { name: 'short', ttl: 1000, limit: 15 },
          { name: 'medium', ttl: 10000, limit: 50 },
          { name: 'long', ttl: 60000, limit: 100 },
        ] : [
          { name: 'short', ttl: 1000, limit: 1000 },
          { name: 'medium', ttl: 10000, limit: 5000 },
          { name: 'long', ttl: 60000, limit: 10000 },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            keyPrefix: process.env.REDIS_PREFIX || (process.env.NODE_ENV === 'test' ? 'test:ratelimit:' : 'dev:ratelimit:'),
            enableOfflineQueue: process.env.NODE_ENV === 'test',
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 100, 2000),
          }),
        ),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  async onModuleInit() {
    try {
      this.logger.log('[AppModule] Running self-healing schema migrations...');
      await db.execute(sql`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'report_target_type' AND enumlabel = 'MESSAGE') THEN
            ALTER TYPE report_target_type ADD VALUE 'MESSAGE';
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_visibility') THEN
            CREATE TYPE community_visibility AS ENUM ('PUBLIC', 'PRIVATE');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_role') THEN
            CREATE TYPE community_role AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_channel_type') THEN
            CREATE TYPE community_channel_type AS ENUM ('TEXT');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hackathon_mode') THEN
            CREATE TYPE hackathon_mode AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hackathon_canonical_status') THEN
            CREATE TYPE hackathon_canonical_status AS ENUM ('UPCOMING', 'REGISTRATION_OPEN', 'DEADLINE_SOON', 'REGISTRATION_CLOSED', 'ONGOING', 'ENDED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_status') THEN
            CREATE TYPE team_status AS ENUM ('OPEN', 'FULL', 'CLOSED', 'DISBANDED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_role_category') THEN
            CREATE TYPE team_role_category AS ENUM ('FRONTEND', 'BACKEND', 'AI_ML', 'UI_UX', 'DEVOPS', 'PRODUCT', 'RESEARCH', 'BLOCKCHAIN', 'DATA', 'OTHER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_request_status') THEN
            CREATE TYPE team_request_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_invitation_status') THEN
            CREATE TYPE team_invitation_status AS ENUM ('TEAM_INVITATION_PENDING', 'TEAM_INVITATION_ACCEPTED', 'TEAM_INVITATION_DECLINED', 'TEAM_INVITATION_EXPIRED');
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collaboration_intent') THEN
            CREATE TYPE collaboration_intent AS ENUM ('LOOKING_FOR_TEAMMATES', 'OPEN_TO_COLLABORATION', 'JUST_EXPLORING');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability') THEN
            CREATE TYPE availability AS ENUM ('WEEKDAYS', 'WEEKENDS', 'FLEXIBLE');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collaboration_request_status') THEN
            CREATE TYPE collaboration_request_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'COMMUNITY_INVITE') THEN
            ALTER TYPE notification_type ADD VALUE 'COMMUNITY_INVITE';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'TEAM_JOIN_REQUEST') THEN
            ALTER TYPE notification_type ADD VALUE 'TEAM_JOIN_REQUEST';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'TEAM_JOIN_ACCEPTED') THEN
            ALTER TYPE notification_type ADD VALUE 'TEAM_JOIN_ACCEPTED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'TEAM_JOIN_REJECTED') THEN
            ALTER TYPE notification_type ADD VALUE 'TEAM_JOIN_REJECTED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'TEAM_INVITATION_RECEIVED') THEN
            ALTER TYPE notification_type ADD VALUE 'TEAM_INVITATION_RECEIVED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'TEAM_INVITATION_ACCEPTED') THEN
            ALTER TYPE notification_type ADD VALUE 'TEAM_INVITATION_ACCEPTED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'COLLABORATION_REQUEST') THEN
            ALTER TYPE notification_type ADD VALUE 'COLLABORATION_REQUEST';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'COLLABORATION_ACCEPTED') THEN
            ALTER TYPE notification_type ADD VALUE 'COLLABORATION_ACCEPTED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'COLLABORATION_DECLINED') THEN
            ALTER TYPE notification_type ADD VALUE 'COLLABORATION_DECLINED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'TEAM_ROLE_MATCH') THEN
            ALTER TYPE notification_type ADD VALUE 'TEAM_ROLE_MATCH';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'notification_type' AND enumlabel = 'HACKATHON_MATCH') THEN
            ALTER TYPE notification_type ADD VALUE 'HACKATHON_MATCH';
          END IF;
        END $$;

        ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID;
        ALTER TABLE community_reports ADD COLUMN IF NOT EXISTS snapshot_content TEXT;

        CREATE TABLE IF NOT EXISTS communities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          avatar_url TEXT,
          banner_url TEXT,
          owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          visibility community_visibility NOT NULL DEFAULT 'PUBLIC',
          category VARCHAR(100) NOT NULL DEFAULT 'General',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS community_members (
          community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role community_role NOT NULL DEFAULT 'MEMBER',
          joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
          PRIMARY KEY (community_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS community_channels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(100) NOT NULL,
          type community_channel_type NOT NULL DEFAULT 'TEXT',
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
          action VARCHAR(50) NOT NULL,
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

        CREATE TABLE IF NOT EXISTS hackathons (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provider VARCHAR(100) NOT NULL DEFAULT 'MANUAL',
          external_id VARCHAR(255),
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          organizer VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          url TEXT NOT NULL,
          registration_deadline TIMESTAMP,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          mode hackathon_mode NOT NULL DEFAULT 'ONLINE',
          location VARCHAR(255),
          themes JSONB NOT NULL DEFAULT '[]'::jsonb,
          skills JSONB NOT NULL DEFAULT '[]'::jsonb,
          prize_info TEXT,
          canonical_status hackathon_canonical_status NOT NULL DEFAULT 'UPCOMING',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS hackathon_sync_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provider VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          items_processed INTEGER NOT NULL DEFAULT 0,
          items_created INTEGER NOT NULL DEFAULT 0,
          items_updated INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          started_at TIMESTAMP NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hackathon_teams (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status team_status NOT NULL DEFAULT 'OPEN',
          max_members INTEGER NOT NULL DEFAULT 4,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS hackathon_team_members (
          team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_category team_role_category NOT NULL DEFAULT 'OTHER',
          joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
          PRIMARY KEY (team_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS hackathon_team_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
          role_category team_role_category NOT NULL,
          title VARCHAR(100) NOT NULL,
          description TEXT,
          is_filled BOOLEAN NOT NULL DEFAULT false,
          filled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS team_join_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_category team_role_category NOT NULL DEFAULT 'OTHER',
          message TEXT,
          status team_request_status NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS team_invitations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          team_id UUID NOT NULL REFERENCES hackathon_teams(id) ON DELETE CASCADE,
          inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_category team_role_category NOT NULL DEFAULT 'OTHER',
          message TEXT,
          status team_invitation_status NOT NULL DEFAULT 'TEAM_INVITATION_PENDING',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
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
      `);
      this.logger.log('[AppModule] Schema migrations complete.');
    } catch (err: any) {
      this.logger.error(`[AppModule] Migration error: ${err.message}`);
    }
  }
}
