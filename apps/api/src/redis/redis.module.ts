import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          keyPrefix: process.env.REDIS_PREFIX || (process.env.NODE_ENV === 'test' ? 'test:' : 'dev:'),
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
