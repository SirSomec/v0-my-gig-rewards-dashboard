export class LevelResponseDto {
  id!: number;
  name!: string;
  shiftsRequired!: number;
  /** Минимум смен за календарный месяц (UTC) для сохранения уровня; null = удержание не требуется */
  monthlyShiftsRequiredToKeep!: number | null;
  /** Массив перков уровня: title, опционально description и icon (значок для отображения) */
  perks!: Array<{ title: string; description?: string; icon?: string }>;
  sortOrder!: number;
}
