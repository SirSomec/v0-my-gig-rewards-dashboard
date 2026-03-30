export class MeResponseDto {
  id!: number;
  name!: string | null;
  email!: string | null;
  avatarUrl!: string | null;
  balance!: number;
  levelId!: number;
  levelName!: string;
  nextLevelName!: string | null;
  /** Порог смен следующего уровня (сколько всего смен нужно для перехода). null = следующего уровня нет (макс. уровень). */
  nextLevelShiftsRequired!: number | null;
  shiftsCompleted!: number;
  shiftsRequired!: number;
  /** Минимум смен за календарный месяц (UTC) для сохранения текущего уровня; null = удержание не требуется */
  currentLevelMonthlyShiftsRequiredToKeep!: number | null;
  /** Рейтинг надёжности 0–5 (дробное). По умолчанию 4. */
  reliabilityRating!: number;
  /** На сколько растёт рейтинг за подтверждённую смену. */
  reliabilityRatingIncreasePerShift!: number;
  /** На сколько падает рейтинг за прогул. */
  reliabilityRatingDecreaseNoShow!: number;
  /** На сколько падает рейтинг за позднюю отмену. */
  reliabilityRatingDecreaseLateCancel!: number;
  /** Минимальный рейтинг, чтобы смена засчитывалась в прогресс уровня. */
  reliabilityMinRatingToCountShiftForLevel!: number;
  /** Минимальный рейтинг для автоматического повышения уровня. */
  reliabilityMinRatingToUpgradeLevel!: number;
  /** Засчитываются ли сейчас смены пользователя в прогресс уровня. */
  reliabilityCountsShiftsForLevel!: boolean;
  /** Может ли пользователь сейчас автоматически повышать уровень при достижении порога. */
  reliabilityAllowsLevelUpgrade!: boolean;
  /** Сумма начисленных бонусов за текущий месяц (смены + квесты) */
  monthlyBonusTotal!: number;
  /** Порог бонусов за месяц: при достижении новые квесты не выдаются (0 = без ограничения) */
  questMonthlyBonusCap!: number;
  /** true, если новые квесты ограничены до конца месяца из‑за достижения порога */
  questsLimitedByCap!: boolean;
  /** Статус участия в программе лояльности: active | pending */
  loyaltyStatus!: 'active' | 'pending';
  /** Когда пользователь нажал «Зарегистрироваться» (принял условия); null — ещё не нажал */
  loyaltyRequestedAt!: string | null;
}
