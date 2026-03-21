/** Настройки шаблона квеста, создаваемого при падении рейтинга (хранятся в system_settings). */

export const RATING_RECOVERY_QUEST_SETTINGS_KEY = 'rating_recovery_quest_settings';

export const RATING_RECOVERY_ALLOWED_CONDITION_TYPES = [
  'bookings_count',
  'shifts_count',
  'shifts_count_client',
  'shifts_count_clients',
  'shifts_count_category',
  'hours_count',
  'hours_count_client',
  'hours_count_clients',
  'shifts_series',
  'manual_confirmation',
] as const;

export type RatingRecoveryQuestSettings = {
  enabled: boolean;
  /** Назначать квест, когда рейтинг после снижения ≤ этого значения (0–5) */
  assignBelowRating: number;
  name: string;
  description: string;
  period: 'daily' | 'weekly' | 'monthly';
  conditionType: string;
  conditionConfig: Record<string, unknown>;
  rewardReliabilityRating: number;
  icon: string;
};

export const DEFAULT_RATING_RECOVERY_QUEST_SETTINGS: RatingRecoveryQuestSettings = {
  enabled: false,
  assignBelowRating: 3,
  name: 'Восстановление рейтинга',
  description: 'Выполните условие, чтобы повысить рейтинг надёжности. Монеты не начисляются.',
  period: 'monthly',
  conditionType: 'shifts_count',
  conditionConfig: { total: 3 },
  rewardReliabilityRating: 0.3,
  icon: 'target',
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function parseRatingRecoveryQuestSettings(raw: unknown): RatingRecoveryQuestSettings {
  const base = { ...DEFAULT_RATING_RECOVERY_QUEST_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  if (o.enabled === true || o.enabled === false) base.enabled = o.enabled;
  const ab = Number(o.assignBelowRating);
  if (!Number.isNaN(ab)) base.assignBelowRating = clamp(ab, 0, 5);
  if (typeof o.name === 'string' && o.name.trim()) base.name = o.name.trim().slice(0, 256);
  if (typeof o.description === 'string') base.description = o.description.slice(0, 512);
  if (o.period === 'daily' || o.period === 'weekly' || o.period === 'monthly') base.period = o.period;
  if (typeof o.conditionType === 'string' && o.conditionType.trim()) {
    base.conditionType = o.conditionType.trim().slice(0, 64);
  }
  if (o.conditionConfig && typeof o.conditionConfig === 'object' && !Array.isArray(o.conditionConfig)) {
    base.conditionConfig = { ...(o.conditionConfig as Record<string, unknown>) };
  }
  const rr = Number(o.rewardReliabilityRating);
  if (!Number.isNaN(rr) && rr >= 0) base.rewardReliabilityRating = Math.min(5, rr);
  if (typeof o.icon === 'string' && o.icon.trim()) base.icon = o.icon.trim().slice(0, 32);
  return base;
}
