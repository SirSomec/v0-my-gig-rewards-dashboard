export class MeResponseDto {
  id!: number;
  name!: string | null;
  email!: string | null;
  avatarUrl!: string | null;
  balance!: number;
  levelId!: number;
  levelName!: string;
  nextLevelName!: string | null;
  shiftsCompleted!: number;
  shiftsRequired!: number;
  /** Штрафы за последние 30 дней (для обратной совместимости) */
  strikesCount!: number;
  /** Порог за 30 дней (устаревший; приоритет у лимитов за неделю/месяц) */
  strikesThreshold!: number | null;
  /** Штрафов за текущую неделю */
  strikesCountWeek!: number;
  /** Штрафов за текущий месяц */
  strikesCountMonth!: number;
  /** Лимит штрафов за неделю для текущего уровня (null = не учитывается) */
  strikesLimitPerWeek!: number | null;
  /** Лимит штрафов за месяц для текущего уровня (null = не учитывается) */
  strikesLimitPerMonth!: number | null;
}
