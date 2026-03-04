import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/drizzle/schemas';
import { drizzleProvider } from '../db/drizzle/drizzle.module';

/**
 * Health-индикатор для проверки подключения к БД Drizzle. Замена @mygigtechnologies/healthcheck.
 */
@Injectable()
export class DrizzleHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('Drizzle check failed', {
        [key]: { status: 'down', error: String(e) },
      });
    }
  }
}
