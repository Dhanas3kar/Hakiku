import { Module } from '@nestjs/common';
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
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { ExecutionContext, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly appLogger = new Logger(AppThrottlerGuard.name);

  protected async handleRequest(requestProps: any): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' && process.env.TEST_ENABLE_RATE_LIMIT !== 'true') {
      return true;
    }

    try {
      return await super.handleRequest(requestProps);
    } catch (err: any) {
      // If it's an intentional rate limit exception (429 Too Many Requests), rethrow it
      if (err.status === 429 || err.name === 'ThrottlerException') {
        throw err;
      }

      this.appLogger.error(`Throttler storage error: ${err.message}`, err.stack);

      // Inspect the request to determine if it's security-critical
      const req = requestProps.context.switchToHttp().getRequest();
      const path = req.routeOptions?.url || req.url || '';

      const isSecurityCritical = path.includes('/auth') || path.includes('/admin');

      if (isSecurityCritical) {
        // Fail closed
        throw new ServiceUnavailableException('Authentication services are temporarily unavailable.');
      }

      // Fail open for general endpoints (feed, profile, etc.) to maintain availability
      return true;
    }
  }
}

@Module({
  imports: [
    RedisModule,
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
        throttlers: process.env.NODE_ENV === 'test' ? [
          { name: 'short', ttl: 1000, limit: 1000 },
          { name: 'medium', ttl: 10000, limit: 5000 },
          { name: 'long', ttl: 60000, limit: 10000 },
        ] : [
          { name: 'short', ttl: 1000, limit: 15 },
          { name: 'medium', ttl: 10000, limit: 50 },
          { name: 'long', ttl: 60000, limit: 100 },
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
  ],
})
export class AppModule {}
