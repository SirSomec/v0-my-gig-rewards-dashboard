export class RecordShiftCompleteRequestDto {
  coins!: number;
  title?: string;
  location?: string;
}

export class RegisterStrikeRequestDto {
  type!: 'no_show' | 'late_cancel';
  shiftExternalId?: string;
}
