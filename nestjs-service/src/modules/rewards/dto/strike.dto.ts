/** Элемент истории штрафов пользователя (для отображения «за какую смену»). */
export class StrikeResponseDto {
  id!: number;
  type!: string; // 'no_show' | 'late_cancel'
  /** ID смены в основной системе — за какую смену получен штраф */
  shiftExternalId!: string | null;
  occurredAt!: string;
  /** Снят ли штраф (не показывать в «активных» лимитах) */
  removedAt!: string | null;
}
