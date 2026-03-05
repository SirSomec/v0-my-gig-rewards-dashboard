export class RecordShiftCompleteRequestDto {
  coins!: number;
  title?: string;
  location?: string;
  /** ID или код бренда/клиента */
  clientId?: string;
  /** Категория/профессия смены */
  category?: string;
  /** Отработанные часы */
  hours?: number;
}

export class RegisterStrikeRequestDto {
  type!: 'no_show' | 'late_cancel';
  shiftExternalId?: string;
}
