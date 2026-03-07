import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Envs } from '../../shared/env.validation-schema';

export interface TojJob {
  _id: string;
  status?: string;
  workerId?: string;
  customName?: string;
  spec?: string;
  description?: string;
  clientId?: string;
  start?: string;
  finish?: string;
  createdAt?: string;
  updatedAt?: string;
  hours?: number;
  salaryPerHour?: number;
  paymentPerHour?: number;
  /** Мок: инициатор последней смены статуса (как meta в TOJ job.update.command) */
  statusChangeMeta?: { initiatorType?: string; initiator?: string; at?: string };
  meta?: { initiatorType?: string; initiator?: string };
  [key: string]: unknown;
}

export interface TojFindJobsFilters {
  workerIds?: string[];
  statuses?: string[];
  updatedAtGte?: string;
}

export interface TojFindJobsOptions {
  limit: number;
  skip: number;
}

@Injectable()
export class TojClientService {
  constructor(private readonly config: ConfigService<Envs, true>) {}

  private getBaseUrl(): string | null {
    const url = this.config.get('TOJ_BASE_URL', { infer: true });
    return url?.trim() || null;
  }

  private getAuth(): { user: string; password: string } | null {
    const user = this.config.get('TOJ_USER', { infer: true })?.trim();
    const password = this.config.get('TOJ_PASSWORD', { infer: true });
    if (!user) return null;
    return { user, password: password ?? '' };
  }

  isConfigured(): boolean {
    return !!this.getBaseUrl() && !!this.getAuth();
  }

  /**
   * Запрос смен из TOJ: POST /job.find-many.query с Basic Auth.
   */
  async findJobs(
    filters: TojFindJobsFilters,
    options: TojFindJobsOptions,
  ): Promise<{ items: TojJob[] }> {
    const baseUrl = this.getBaseUrl();
    const auth = this.getAuth();
    if (!baseUrl || !auth) {
      throw new Error('TOJ not configured (TOJ_BASE_URL, TOJ_USER, TOJ_PASSWORD)');
    }
    const limit = Math.min(Math.max(options.limit || 100, 1), 1000);
    const skip = Math.max(options.skip || 0, 0);
    const body: {
      data: {
        filters: Record<string, unknown>;
        projection: string;
        options: { limit: number; skip: number; sort: Record<string, number> };
      };
    } = {
      data: {
        filters: {},
        projection: '',
        options: { limit, skip, sort: { updatedAt: -1 } },
      },
    };
    if (filters.workerIds?.length) {
      body.data.filters.workerIds = filters.workerIds;
    }
    if (filters.statuses?.length) {
      body.data.filters.statuses = filters.statuses;
    }
    if (filters.updatedAtGte) {
      body.data.filters.updatedAt = [`gte:${filters.updatedAtGte}`];
    }
    const url = `${baseUrl.replace(/\/$/, '')}/job.find-many.query`;
    const basic = Buffer.from(`${auth.user}:${auth.password}`, 'utf8').toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TOJ find-many: ${res.status} ${text || res.statusText}`);
    }
    const json = (await res.json()) as { data?: TojJob[] | null; error?: unknown };
    if (json.error != null) {
      throw new Error(String(json.error));
    }
    const items = Array.isArray(json.data) ? json.data : [];
    return { items };
  }
}
