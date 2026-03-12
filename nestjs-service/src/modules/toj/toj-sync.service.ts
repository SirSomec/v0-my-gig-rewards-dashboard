import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Envs } from '../../shared/env.validation-schema';
import { TojClientService } from './toj-client.service';
import { RewardsService } from '../rewards/rewards.service';
import { TojSyncRepository } from './toj-sync.repository';

const WATERMARK_KEY = 'toj_sync_last_updated_at';
/** Время последнего запуска синхронизации (для ограничения «не чаще чем раз в N минут»). */
const LAST_RUN_AT_KEY = 'toj_sync_last_run_at';

export interface TojSyncResult {
  processed: number;
  skipped: number;
  /** Штрафов «поздняя отмена» начислено за смены со статусом cancelled (initiator=worker, <24ч до начала) */
  lateCancelApplied?: number;
  /** Штрафов «прогул» начислено за смены со статусом failed */
  noShowApplied?: number;
  /** Сколько раз зафиксировано бронирование (статус booked); идемпотентно по jobId */
  bookedRecorded?: number;
  /** Причины пропуска: счётчики по коду причины */
  skippedReasons?: { noUser?: number; jobBeforeUser?: number; alreadySynced?: number; wrongStatus?: number };
  errors: string[];
  watermark?: string;
}

@Injectable()
export class TojSyncService {
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

  getStatus(): { configured: boolean; syncEnabled: boolean } {
    return {
      configured: this.tojClient.isConfigured(),
      syncEnabled: this.isSyncEnabled(),
    };
  }

  async getWatermark(): Promise<string | null> {
    return this.tojSyncRepository.getSettingString(WATERMARK_KEY);
  }

  async setWatermark(iso: string): Promise<void> {
    await this.tojSyncRepository.setSettingString(WATERMARK_KEY, iso);
  }

  /** Время последнего запуска runSync (ISO). Для ограничения частоты вызовов при загрузке главной. */
  async getLastSyncRunAt(): Promise<string | null> {
    return this.tojSyncRepository.getSettingString(LAST_RUN_AT_KEY);
  }

  async setLastSyncRunAt(iso: string): Promise<void> {
    await this.tojSyncRepository.setSettingString(LAST_RUN_AT_KEY, iso);
  }

  /**
   * Запускает синхронизацию смен из TOJ только если прошло не менее minIntervalMs с последнего запуска.
   * Используется при загрузке главной страницы дашборда, чтобы не вызывать sync чаще чем раз в 5 минут.
   */
  async runSyncIfNeeded(minIntervalMs: number): Promise<{ ran: boolean; result?: TojSyncResult }> {
    const lastRunAt = await this.getLastSyncRunAt();
    const now = new Date();
    if (lastRunAt) {
      const elapsed = now.getTime() - new Date(lastRunAt).getTime();
      if (elapsed < minIntervalMs) {
        return { ran: false };
      }
    }
    const result = await this.runSync();
    await this.setLastSyncRunAt(now.toISOString());
    return { ran: true, result };
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

    // Водяной знак: запрашиваем только смены с updatedAt >= watermark. Смена может менять статус
    // в течение 30 дней после даты старта — при смене статуса TOJ обновляет запись, мы подхватываем по updatedAt.
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
      usersWithExt
        .filter((u) => u.externalId)
        .map((u) => [
          String(u.externalId).trim(),
          { id: u.id, createdAt: u.createdAt as Date },
        ]),
    );

    if (workerIds.length === 0) {
      return {
        processed: 0,
        skipped: 0,
        errors: [
          'Нет пользователей с заполненным external_id. Добавьте external_id пользователям (в БД или через раздел «Пользователи» / ETL) и повторите синхронизацию.',
        ],
      };
    }

    let processed = 0;
    let skipped = 0;
    let lateCancelApplied = 0;
    let noShowApplied = 0;
    let bookedRecorded = 0;
    const skippedReasons: { noUser: number; jobBeforeUser: number; alreadySynced: number; wrongStatus: number } = {
      noUser: 0,
      jobBeforeUser: 0,
      alreadySynced: 0,
      wrongStatus: 0,
    };
    const errors: string[] = [];
    let maxUpdatedAt = watermark;

    // Запрашиваем смены со всеми статусами (без фильтра statuses), чтобы обрабатывать и confirmed, и cancelled
    for (let b = 0; b < workerIds.length; b += workerBatchSize) {
      const batch = workerIds.slice(b, b + workerBatchSize);
      let skip = 0;
      while (true) {
        if (processed + skipped + lateCancelApplied + bookedRecorded + noShowApplied >= maxJobsPerRun) break;
        const { items } = await this.tojClient.findJobs(
          {
            workerIds: batch,
            updatedAtGte: watermark,
          },
          { limit: pageSize, skip },
        );
        if (items.length === 0) break;
        for (const job of items) {
          if (processed + skipped + lateCancelApplied + bookedRecorded + noShowApplied >= maxJobsPerRun) break;
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

          // Забронированная смена (статус booked): фиксируем факт бронирования для квеста «забронировать смены».
          // Один раз записанное бронирование не обнуляется при смене статуса (confirmed/cancelled).
          if (status === 'booked') {
            try {
              const result = await this.rewards.recordShiftBooked(
                user.id,
                String(job._id),
                (job.customName as string) || (job.spec as string) || 'Смена',
                job.clientId as string | undefined,
                job.spec as string | undefined,
              );
              if (result.recorded) bookedRecorded++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id} (booked): ${msg}`);
            }
            continue;
          }

          // Подтверждённая смена (только статус confirmed) — начисление
          // Если по этой смене ранее был штраф (прогул или поздняя отмена) — снимаем его и восстанавливаем уровень
          if (status === 'confirmed') {
            await this.rewards.removeStrikeByShiftExternalId(String(job._id));
            const jobDate = job.start || job.createdAt;
            if (jobDate && user.createdAt && new Date(jobDate) < new Date(user.createdAt)) {
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
              );
              processed++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id}: ${msg}`);
            }
            continue;
          }

          // Отменённая смена — штраф «поздняя отмена», если initiator=worker и <24ч до начала
          if (status === 'cancelled') {
            const meta = job.statusChangeMeta ?? job.meta;
            const initiatorType = (meta?.initiatorType ?? (job as { initiatorType?: string }).initiatorType)?.trim?.();
            const initiator = (meta?.initiator ?? (job as { initiator?: string }).initiator)?.trim?.();
            const cancelledAt = (meta && 'at' in meta && typeof meta.at === 'string' ? meta.at : null) ?? job.updatedAt ?? job.createdAt;
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
              const result = await this.rewards.processLateCancelIfEligible(payload);
              if (result.applied) lateCancelApplied++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id} (late_cancel): ${msg}`);
            }
            continue;
          }

          // Смена в статусе failed — засчитываем как прогул (no_show)
          if (status === 'failed') {
            try {
              const result = await this.rewards.processNoShowIfEligible({
                jobId: String(job._id),
                workerId: String(job.workerId ?? '').trim(),
              });
              if (result.applied) noShowApplied++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(`Job ${job._id} (no_show): ${msg}`);
            }
            continue;
          }

          // Остальные статусы — пока не обрабатываем
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

    if (processed === 0 && skipped === 0 && lateCancelApplied === 0 && noShowApplied === 0 && bookedRecorded === 0 && errors.length === 0) {
      errors.push(
        'В TOJ не найдено смен для ваших работников (workerId = external_id) за период watermark. Сгенерируйте смены в разделе «Мок TOJ» или проверьте фильтры.',
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
      if (skippedReasons.jobBeforeUser > 0) result.skippedReasons.jobBeforeUser = skippedReasons.jobBeforeUser;
      if (skippedReasons.alreadySynced > 0) result.skippedReasons.alreadySynced = skippedReasons.alreadySynced;
      if (skippedReasons.wrongStatus > 0) result.skippedReasons.wrongStatus = skippedReasons.wrongStatus;
    }
    return result;
  }
}
