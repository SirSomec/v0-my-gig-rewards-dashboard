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

export class UserRedemptionResponseDto {
  id!: number;
  storeItemId!: number;
  itemName!: string;
  itemCategory!: string;
  itemIcon!: string;
  status!: 'pending' | 'fulfilled' | 'cancelled';
  coinsSpent!: number;
  createdAt!: string;
  processedAt!: string | null;
  notes!: string | null;
}

export class CreateRedemptionRequestDto {
  storeItemId!: number;
}
