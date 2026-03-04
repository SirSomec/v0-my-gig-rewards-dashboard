export class StoreItemResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  category!: string;
  cost!: number;
  icon!: string;
  /** Общий лимит количества товара (null = без лимита). Ограниченный тираж. */
  stockLimit?: number | null;
  /** Сколько уже выкуплено (заявки pending + fulfilled) по этому товару. */
  redeemedCount?: number;
}

export class CreateRedemptionRequestDto {
  storeItemId!: number;
}
