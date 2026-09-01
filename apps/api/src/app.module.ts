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
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

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
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: process.env.NODE_ENV === 'test' ? [
          { name: 'short', ttl: 1000, limit: 100 },
          { name: 'medium', ttl: 10000, limit: 1000 },
          { name: 'long', ttl: 60000, limit: 5000 },
        ] : [
          {
            name: 'short',
            ttl: 1000,
            limit: 15,
          },
          {
            name: 'medium',
            ttl: 10000,
            limit: 50,
          },
          {
            name: 'long',
            ttl: 60000,
            limit: 100,
          },
        ],
        storage: new ThrottlerStorageRedisService(
          new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            keyPrefix: process.env.REDIS_PREFIX || (process.env.NODE_ENV === 'test' ? 'test:ratelimit:' : 'dev:ratelimit:'),
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
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
