import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          keyPrefix: process.env.REDIS_PREFIX || (process.env.NODE_ENV === 'test' ? 'test:' : 'dev:'),
          enableOfflineQueue: process.env.NODE_ENV === 'test',
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            return Math.min(times * 100, 2000); // Backoff capped at 2 seconds
          },
        });

        client.on('error', (err) => {
          // Prevent unhandled exception crashes
          // We don't use NestJS Logger here because it's a raw factory
          console.error('[RedisModule] Connection error:', err.message);
        });

        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
