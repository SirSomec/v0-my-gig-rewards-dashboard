export class LevelResponseDto {
  id!: number;
  name!: string;
  shiftsRequired!: number;
  /** Массив перков уровня: title, опционально description */
  perks!: Array<{ title: string; description?: string }>;
  sortOrder!: number;
}
