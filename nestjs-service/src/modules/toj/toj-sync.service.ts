import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infra/db/drizzle/schemas';
import { drizzleProvider } from '../../infra/db/drizzle/drizzle.module';
import { Inject } from '@nestjs/common';
import type { Envs } from '../../shared/env.validation-schema';
import { TojClientService } from './toj-client.service';
import { RewardsService } from '../rewards/rewards.service';

const WATERMARK_KEY = 'toj_sync_last_updated_at';

export interface TojSyncResult {
  processed: number;
  skipped: number;
  errors: string[];
  watermark?: string;
}

@Injectable()
export class TojSyncService {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly config: ConfigService<Envs, true>,
    private readonly tojClient: TojClientService,
    private readonly rewards: RewardsService,
  ) {}

  isSyncEnabled(): boolean {
    const enabled = this.config.get('TOJ_SYNC_ENABLED', { infer: true });
    return enabled === 'true' || enabled === '1';
  }

  getStatus(): { configured: boolean; syncEnabled: boolean } {
    return {
      configured: this.tojClient.isConfigured(),
      syncEnabled: this.isSyncEnabled(),
    };
  }

  async getWatermark(): Promise<string | null> {
    const { systemSettings } = schema;
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, WATERMARK_KEY))
      .limit(1);
    if (!row?.value) return null;
    const v = row.value;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v != null && typeof (v as { value?: string }).value === 'string') {
      return (v as { value: string }).value;
    }
    return null;
  }

  async setWatermark(iso: string): Promise<void> {
    const { systemSettings } = schema;
    const now = new Date();
    await this.db
      .insert(systemSettings)
      .values({ key: WATERMARK_KEY, value: iso })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: iso, updatedAt: now },
      });
  }

  async runSync(): Promise<TojSyncResult> {
    if (!this.tojClient.isConfigured()) {
      return { processed: 0, skipped: 0, errors: ['TOJ not configured'] };
    }
    if (!this.isSyncEnabled()) {
      return { processed: 0, skipped: 0, errors: ['TOJ sync is disabled (TOJ_SYNC_ENABLED)'] };
    }
    const maxJobsPerRun = this.config.get('TOJ_SYNC_MAX_JOBS_PER_RUN', { infer: true }) ?? 1000;
    const pageSize = this.config.get('TOJ_SYNC_PAGE_SIZE', { infer: true }) ?? 500;
    const workerBatchSize = this.config.get('TOJ_SYNC_WORKER_BATCH_SIZE', { infer: true }) ?? 200;
    const initialDaysAgo = this.config.get('TOJ_SYNC_INITIAL_DAYS_AGO', { infer: true }) ?? 7;

    let watermark = await this.getWatermark();
    if (!watermark) {
      const d = new Date();
      d.setDate(d.getDate() - initialDaysAgo);
      watermark = d.toISOString();
    }

    const { users, transactions } = schema;
    const usersWithExt = await this.db
      .select({ id: users.id, externalId: users.externalId, createdAt: users.createdAt })
      .from(users)
      .where(sql`${users.externalId} IS NOT NULL AND ${users.externalId} != ''`);
    const workerIds = usersWithExt
      .map((u) => u.externalId as string)
      .filter((id): id is string => !!id);
    const userByWorkerId = new Map(
      usersWithExt
        .filter((u) => u.externalId)
        .map((u) => [
          String(u.externalId).trim(),
          { id: u.id, createdAt: u.createdAt as Date },
        ]),
    );

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];
    let maxUpdatedAt = watermark;

    for (let b = 0; b < workerIds.length; b += workerBatchSize) {
      const batch = workerIds.slice(b, b + workerBatchSize);
      let skip = 0;
      while (true) {
        if (processed + skipped >= maxJobsPerRun) break;
        const { items } = await this.tojClient.findJobs(
          {
            workerIds: batch,
            statuses: ['completed', 'confirmed'],
            updatedAtGte: watermark,
          },
          { limit: pageSize, skip },
        );
        if (items.length === 0) break;
        for (const job of items) {
          if (processed + skipped >= maxJobsPerRun) break;
          const jobUpdatedAt = job.updatedAt || job.createdAt;
          if (jobUpdatedAt && jobUpdatedAt > maxUpdatedAt) {
            maxUpdatedAt = jobUpdatedAt;
          }
          const user = job.workerId ? userByWorkerId.get(String(job.workerId).trim()) : undefined;
          if (!user) {
            skipped++;
            continue;
          }
          const jobDate = job.start || job.createdAt;
          if (jobDate && user.createdAt && new Date(jobDate) < new Date(user.createdAt)) {
            skipped++;
            continue;
          }
          const [existing] = await this.db
            .select({ id: transactions.id })
            .from(transactions)
            .where(
              and(eq(transactions.type, 'shift'), eq(transactions.sourceRef, String(job._id))),
            )
            .limit(1);
          if (existing) {
            skipped++;
            continue;
          }
          try {
            await this.rewards.recordShiftCompleted(
              user.id,
              0,
              (job.customName as string) || (job.spec as string) || 'Смена',
              undefined,
              job.clientId as string | undefined,
              job.spec as string | undefined,
              typeof job.hours === 'number' ? job.hours : undefined,
              String(job._id),
            );
            processed++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Job ${job._id}: ${msg}`);
          }
        }
        skip += items.length;
        if (items.length < pageSize) break;
      }
    }

    if (maxUpdatedAt !== watermark) {
      await this.setWatermark(maxUpdatedAt);
    }

    return { processed, skipped, errors, watermark: maxUpdatedAt };
  }
}
