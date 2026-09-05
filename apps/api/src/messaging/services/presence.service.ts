import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
}


@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly TTL_SECONDS = 30;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private getPresenceKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  /**
   * Updates or establishes user presence online status with 30s TTL.
   */
  async heartbeat(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const key = this.getPresenceKey(userId);
      const data = JSON.stringify({
        userId,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
      });
      await this.redis.set(key, data, 'EX', this.TTL_SECONDS);
    } catch (err: any) {
      this.logger.error(`Presence heartbeat failed for user ${userId}: ${err.message}`);
    }
  }

  /**
   * Manually sets user presence to offline by removing the key.
   */
  async setOffline(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const key = this.getPresenceKey(userId);
      await this.redis.del(key);
    } catch (err: any) {
      this.logger.error(`Presence setOffline failed for user ${userId}: ${err.message}`);
    }
  }

  /**
   * Gets presence status for a single user. Missing/expired key = offline.
   */
  async getUserPresence(userId: string): Promise<UserPresence> {
    if (!userId) {
      return { userId, status: 'offline', lastSeenAt: new Date(0).toISOString() };
    }
    try {
      const key = this.getPresenceKey(userId);
      const val = await this.redis.get(key);
      if (val) {
        return JSON.parse(val);
      }
    } catch (err: any) {
      this.logger.error(`Get presence failed for user ${userId}: ${err.message}`);
    }
    return { userId, status: 'offline', lastSeenAt: new Date(0).toISOString() };
  }

  /**
   * Gets presence status for multiple users concurrently via pipeline/MGET.
   */
  async getBulkPresence(userIds: string[]): Promise<UserPresence[]> {
    if (!userIds || userIds.length === 0) return [];
    try {
      const keys = userIds.map((id) => this.getPresenceKey(id));
      const results = await this.redis.mget(...keys);

      return userIds.map((userId, idx) => {
        const val = results[idx];
        if (val) {
          try {
            return JSON.parse(val);
          } catch (e) {
            // Fallthrough
          }
        }
        return { userId, status: 'offline', lastSeenAt: new Date(0).toISOString() };
      });
    } catch (err: any) {
      this.logger.error(`Get bulk presence failed: ${err.message}`);
      return userIds.map((userId) => ({
        userId,
        status: 'offline',
        lastSeenAt: new Date(0).toISOString(),
      }));
    }
  }
}
