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
  /** Штрафов за текущую неделю */
  strikesCountWeek!: number;
  /** Штрафов за текущий месяц */
  strikesCountMonth!: number;
  /** Лимит штрафов за неделю для текущего уровня (null = не учитывается) */
  strikesLimitPerWeek!: number | null;
  /** Лимит штрафов за месяц для текущего уровня (null = не учитывается) */
  strikesLimitPerMonth!: number | null;
}
