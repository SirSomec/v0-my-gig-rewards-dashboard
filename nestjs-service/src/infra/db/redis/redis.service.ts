import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';

import { Envs } from '../../../shared/env.validation-schema';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisClient;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<Envs, true>,
  ) {
    const REDIS_DB = this.configService.get('REDIS_DB', { infer: true });
    const REDIS_HOST = this.configService.get('REDIS_HOST', { infer: true });
    const REDIS_PORT = this.configService.get('REDIS_PORT', { infer: true });
    const REDIS_PASSWORD = this.configService.get('REDIS_PASSWORD', {
      infer: true,
    });

    this.client = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      db: REDIS_DB,
      maxRetriesPerRequest: null,
    });
  }

  getClient(): RedisClient {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client.status === 'end' || this.client.status === 'wait') {
      return;
    }

    await this.client.quit();
  }
}
