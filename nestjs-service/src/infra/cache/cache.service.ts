import { Injectable } from '@nestjs/common';
import type { RedisKey } from 'ioredis';

import { RedisService } from '../db/redis/redis.service';

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  async get<T>(key: RedisKey): Promise<T | null> {
    const value = await this.redisService.getClient().get(key);

    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set<T>(key: RedisKey, value: T, ttlSeconds?: number): Promise<void> {
    const normalizedValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds && ttlSeconds > 0) {
      const ttl = Math.round(ttlSeconds);

      await this.redisService.getClient().set(key, normalizedValue, 'EX', ttl);
      return;
    }

    await this.redisService.getClient().set(key, normalizedValue);
  }

  async del(key: RedisKey): Promise<void> {
    await this.redisService.getClient().del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const client = this.redisService.getClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      cursor = nextCursor;

      if (keys.length === 0) {
        continue;
      }

      await client.del(...keys);
    } while (cursor !== '0');
  }

  async reset(): Promise<void> {
    await this.redisService.getClient().flushdb();
  }
}
