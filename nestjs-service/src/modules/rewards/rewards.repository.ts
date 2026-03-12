import { Inject, Injectable } from '@nestjs/common';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';

@Injectable()
export class RewardsRepository {
  constructor(
    @Inject(drizzleProvider)
    private readonly client: PostgresJsDatabase<typeof schema>,
  ) {}

  get db(): PostgresJsDatabase<typeof schema> {
    return this.client;
  }
}
