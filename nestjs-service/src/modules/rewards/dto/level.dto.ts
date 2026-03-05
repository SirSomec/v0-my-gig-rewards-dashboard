export class LevelResponseDto {
  id!: number;
  name!: string;
  shiftsRequired!: number;
  /** Массив перков уровня: title, опционально description и icon (значок для отображения) */
  perks!: Array<{ title: string; description?: string; icon?: string }>;
  sortOrder!: number;
}
