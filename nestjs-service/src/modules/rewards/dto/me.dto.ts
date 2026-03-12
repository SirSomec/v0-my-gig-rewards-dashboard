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
  /** Рейтинг надёжности 0–5 (дробное). По умолчанию 4. */
  reliabilityRating!: number;
  /** Сумма начисленных бонусов за текущий месяц (смены + квесты) */
  monthlyBonusTotal!: number;
  /** Порог бонусов за месяц: при достижении новые квесты не выдаются (0 = без ограничения) */
  questMonthlyBonusCap!: number;
  /** true, если новые квесты ограничены до конца месяца из‑за достижения порога */
  questsLimitedByCap!: boolean;
}
