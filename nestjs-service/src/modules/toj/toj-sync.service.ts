import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import type { Envs } from '../../shared/env.validation-schema';
import { RewardsService } from '../rewards/rewards.service';
import { TojClientService } from './toj-client.service';
import { TojSyncRepository } from './toj-sync.repository';

const WATERMARK_KEY = 'toj_sync_last_updated_at';
const LAST_RUN_AT_KEY = 'toj_sync_last_run_at';
const LAST_SUCCESS_AT_KEY = 'toj_sync_last_success_at';
const LAST_RESULT_KEY = 'toj_sync_last_result';
const MIN_SYNC_INTERVAL_MS = 60 * 1000;

export interface TojSyncResult {
  processed: number;
  skipped: number;
  lateCancelApplied?: number;
  noShowApplied?: number;
  bookedRecorded?: number;
  skippedReasons?: {
    noUser?: number;
    jobBeforeUser?: number;
    alreadySynced?: number;
    wrongStatus?: number;
  };
  errors: string[];
  watermark?: string;
}

export interface TojSyncStatus {
  configured: boolean;
  syncEnabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  watermark: string | null;
  lastResult: Record<string, unknown> | null;
}

export interface TojSyncRunResponse extends TojSyncResult {
  ran: boolean;
  reason?: string;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
}

@Injectable()
export class TojSyncService {
  private readonly logger = new Logger(TojSyncService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService<Envs, true>,
    private readonly tojClient: TojClientService,
    private readonly rewards: RewardsService,
    private readonly tojSyncRepository: TojSyncRepository,
  ) {}

  isSyncEnabled(): boolean {
    const enabled = this.config.get('TOJ_SYNC_ENABLED', { infer: true });
    return enabled === 'true' || enabled === '1';
  }

  async getStatus(): Promise<TojSyncStatus> {
    return {
      configured: this.tojClient.isConfigured(),
      syncEnabled: this.isSyncEnabled(),
      running: this.running,
      lastRunAt: await this.getLastSyncRunAt(),
      lastSuccessAt: await this.getLastSuccessAt(),
      watermark: await this.getWatermark(),
      lastResult: await this.getLastResult(),
    };
  }

  async getWatermark(): Promise<string | null> {
    return this.tojSyncRepository.getSettingString(WATERMARK_KEY);
  }

  async setWatermark(iso: string): Promise<void> {
    await this.tojSyncRepository.setSettingString(WATERMARK_KEY, iso);
  }

  async getLastSyncRunAt(): Promise<string | null> {
    return this.tojSyncRepository.getSettingString(LAST_RUN_AT_KEY);
  }

  async setLastSyncRunAt(iso: string): Promise<void> {
    await this.tojSyncRepository.setSettingString(LAST_RUN_AT_KEY, iso);
  }

  async getLastSuccessAt(): Promise<string | null> {
    return this.tojSyncRepository.getSettingString(LAST_SUCCESS_AT_KEY);
  }

  async setLastSuccessAt(iso: string): Promise<void> {
    await this.tojSyncRepository.setSettingString(LAST_SUCCESS_AT_KEY, iso);
  }

  async getLastResult(): Promise<Record<string, unknown> | null> {
    return this.tojSyncRepository.getSettingValue<Record<string, unknown>>(LAST_RESULT_KEY);
  }

  async setLastResult(value: Record<string, unknown>): Promise<void> {
    await this.tojSyncRepository.setSettingValue(LAST_RESULT_KEY, value);
  }

  async runScheduledSync(
    trigger: 'scheduler' | 'manual' = 'scheduler',
  ): Promise<TojSyncRunResponse> {
    const lastRunAt = await this.getLastSyncRunAt();
    const lastSuccessAt = await this.getLastSuccessAt();

    if (!this.tojClient.isConfigured()) {
      return {
        ran: false,
        reason: 'not_configured',
        running: this.running,
        lastRunAt,
        lastSuccessAt,
        processed: 0,
        skipped: 0,
        errors: ['TOJ not configured'],
      };
    }
    if (!this.isSyncEnabled()) {
      return {
        ran: false,
        reason: 'disabled',
        running: this.running,
        lastRunAt,
        lastSuccessAt,
        processed: 0,
        skipped: 0,
        errors: ['TOJ sync is disabled (TOJ_SYNC_ENABLED)'],
      };
    }
    if (this.running) {
      return {
        ran: false,
        reason: 'already_running',
        running: true,
        lastRunAt,
        lastSuccessAt,
        processed: 0,
        skipped: 0,
        errors: ['TOJ sync is already running'],
      };
    }
    if (lastRunAt) {
      const elapsed = Date.now() - new Date(lastRunAt).getTime();
      if (elapsed < MIN_SYNC_INTERVAL_MS) {
        return {
          ran: false,
          reason: 'rate_limited',
          running: false,
          lastRunAt,
          lastSuccessAt,
          processed: 0,
          skipped: 0,
          errors: ['TOJ sync is rate limited to once per minute'],
        };
      }
    }

    const nowIso = new Date().toISOString();
    this.running = true;
    await this.setLastSyncRunAt(nowIso);
    try {
      const result = await this.runSync();
      const successAt = new Date().toISOString();
      await this.setLastSuccessAt(successAt);
      await this.setLastResult({
        trigger,
        ranAt: nowIso,
        ...result,
      });
      return {
        ran: true,
        running: false,
        lastRunAt: nowIso,
        lastSuccessAt: successAt,
        ...result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.setLastResult({
        trigger,
        ranAt: nowIso,
        processed: 0,
        skipped: 0,
        errors: [message],
      });
      return {
        ran: false,
        reason: 'failed',
        running: false,
        lastRunAt: nowIso,
        lastSuccessAt,
        processed: 0,
        skipped: 0,
        errors: [message],
      };
    } finally {
      this.running = false;
    }
  }

  async runSync(): Promise<TojSyncResult> {
    if (!this.tojClient.isConfigured()) {
      return { processed: 0, skipped: 0, errors: ['TOJ not configured'] };
    }
    if (!this.isSyncEnabled()) {
      return { processed: 0, skipped: 0, errors: ['TOJ sync is disabled (TOJ_SYNC_ENABLED)'] };
    }

    const pageSize = this.config.get('TOJ_SYNC_PAGE_SIZE', { infer: true }) ?? 100;
    const workerBatchSize = this.config.get('TOJ_SYNC_WORKER_BATCH_SIZE', { infer: true }) ?? 200;
    const initialDaysAgo = this.config.get('TOJ_SYNC_INITIAL_DAYS_AGO', { infer: true }) ?? 7;

    let watermark = await this.getWatermark();
    if (!watermark) {
      const d = new Date();
      d.setDate(d.getDate() - initialDaysAgo);
      watermark = d.toISOString();
    }

    const usersWithExt = await this.tojSyncRepository.getUsersWithExternalId();
    const workerIds = usersWithExt
      .map((u) => u.externalId as string)
      .filter((id): id is string => !!id);
    const userByWorkerId = new Map(
      usersWithExt.map((u) => [
        String(u.externalId).trim(),
        {
          id: u.id,
          createdAt: u.createdAt as Date,
          loyaltyStartedAt: u.loyaltyStartedAt as Date | null,
        },
      ]),
    );

    if (workerIds.length === 0) {
      return {
        processed: 0,
        skipped: 0,
        errors: [
          'Нет пользователей с заполненным external_id. Добавьте external_id пользователям и повторите синхронизацию.',
        ],
      };
    }

    let processed = 0;
    let skipped = 0;
    let lateCancelApplied = 0;
    let noShowApplied = 0;
    let bookedRecorded = 0;
    const skippedReasons: {
      noUser: number;
      jobBeforeUser: number;
      alreadySynced: number;
      wrongStatus: number;
    } = {
      noUser: 0,
      jobBeforeUser: 0,
      alreadySynced: 0,
      wrongStatus: 0,
    };
    const errors: string[] = [];
    let maxUpdatedAt = watermark;

    for (let b = 0; b < workerIds.length; b += workerBatchSize) {
      const batch = workerIds.slice(b, b + workerBatchSize);
      let skip = 0;
      while (true) {
        const { items } = await this.tojClient.findJobs(
          {
            workerIds: batch,
            updatedAtGte: watermark,
          },
          { limit: pageSize, skip, sortDirection: 'asc' },
        );
        if (items.length === 0) break;

        for (const job of items) {
          const jobUpdatedAt = job.updatedAt || job.createdAt;
          if (jobUpdatedAt && jobUpdatedAt > maxUpdatedAt) {
            maxUpdatedAt = jobUpdatedAt;
          }

          const user = job.workerId ? userByWorkerId.get(String(job.workerId).trim()) : undefined;
          if (!user) {
            skipped++;
            skippedReasons.noUser++;
            continue;
          }

          const status = (job.status ?? '').toLowerCase();
          if (status === 'booked') {
            try {
              const result = await this.rewards.recordShiftBooked(
                user.id,
                String(job._id),
                (job.customName as string) || (job.spec as string) || 'Смена',
                job.clientId as string | undefined,
                job.spec as string | undefined,
                { postProcessMode: 'enqueue' },
              );
              if (result.recorded) bookedRecorded++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id} (booked): ${msg}`);
            }
            continue;
          }

          if (status === 'confirmed') {
            await this.rewards.removeStrikeByShiftExternalId(String(job._id), {
              postProcessMode: 'enqueue',
            });
            const jobDate = job.start || job.createdAt;
            const userStartDate = user.loyaltyStartedAt ?? user.createdAt;
            if (jobDate && userStartDate && new Date(jobDate) < new Date(userStartDate)) {
              skipped++;
              skippedReasons.jobBeforeUser++;
              continue;
            }
            const hasExistingTransaction = await this.tojSyncRepository.hasShiftTransaction(
              String(job._id),
            );
            if (hasExistingTransaction) {
              skipped++;
              skippedReasons.alreadySynced++;
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
                { postProcessMode: 'enqueue' },
              );
              processed++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id}: ${msg}`);
            }
            continue;
          }

          if (status === 'cancelled') {
            const meta = job.statusChangeMeta ?? job.meta;
            const initiatorType =
              (meta?.initiatorType ?? (job as { initiatorType?: string }).initiatorType)?.trim?.();
            const initiator =
              (meta?.initiator ?? (job as { initiator?: string }).initiator)?.trim?.();
            const cancelledAt =
              (meta && 'at' in meta && typeof meta.at === 'string' ? meta.at : null) ??
              job.updatedAt ??
              job.createdAt;
            const jobStart = job.start ?? job.createdAt;
            if (!jobStart || !cancelledAt) {
              skipped++;
              skippedReasons.wrongStatus++;
              continue;
            }
            const payload: Parameters<RewardsService['processLateCancelIfEligible']>[0] = {
              jobId: String(job._id),
              workerId: String(job.workerId ?? '').trim(),
              jobStartIso: jobStart,
              cancelledAtIso: cancelledAt,
            };
            if (initiatorType) payload.initiatorType = initiatorType;
            if (initiator) payload.initiator = initiator;
            try {
              const result = await this.rewards.processLateCancelIfEligible(payload, {
                postProcessMode: 'enqueue',
              });
              if (result.applied) lateCancelApplied++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id} (late_cancel): ${msg}`);
            }
            continue;
          }

          if (status === 'failed') {
            try {
              const result = await this.rewards.processNoShowIfEligible(
                {
                  jobId: String(job._id),
                  workerId: String(job.workerId ?? '').trim(),
                },
                { postProcessMode: 'enqueue' },
              );
              if (result.applied) noShowApplied++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id} (no_show): ${msg}`);
            }
            continue;
          }

          skipped++;
          skippedReasons.wrongStatus++;
        }

        skip += items.length;
        if (items.length < pageSize) break;
      }
    }

    if (maxUpdatedAt !== watermark) {
      await this.setWatermark(maxUpdatedAt);
    }

    if (
      processed === 0 &&
      skipped === 0 &&
      lateCancelApplied === 0 &&
      noShowApplied === 0 &&
      bookedRecorded === 0 &&
      errors.length === 0
    ) {
      errors.push(
        'В TOJ не найдено новых смен для ваших работников за период watermark.',
      );
    }

    const result: TojSyncResult = {
      processed,
      skipped,
      errors,
      watermark: maxUpdatedAt,
    };
    if (lateCancelApplied > 0) result.lateCancelApplied = lateCancelApplied;
    if (noShowApplied > 0) result.noShowApplied = noShowApplied;
    if (bookedRecorded > 0) result.bookedRecorded = bookedRecorded;
    if (skipped > 0) {
      result.skippedReasons = {};
      if (skippedReasons.noUser > 0) result.skippedReasons.noUser = skippedReasons.noUser;
      if (skippedReasons.jobBeforeUser > 0)
        result.skippedReasons.jobBeforeUser = skippedReasons.jobBeforeUser;
      if (skippedReasons.alreadySynced > 0)
        result.skippedReasons.alreadySynced = skippedReasons.alreadySynced;
      if (skippedReasons.wrongStatus > 0)
        result.skippedReasons.wrongStatus = skippedReasons.wrongStatus;
    }
    return result;
  }

  @Interval(60 * 1000)
  async handlePeriodicSync(): Promise<void> {
    try {
      const result = await this.runScheduledSync('scheduler');
      if (result.ran && result.errors.length > 0) {
        this.logger.warn(
          `TOJ periodic sync completed with errors: ${result.errors.join('; ')}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`TOJ periodic sync failed: ${msg}`);
    }
  }
}
