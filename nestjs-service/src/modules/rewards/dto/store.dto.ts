export class StoreItemResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  category!: string;
  cost!: number;
  icon!: string;
}

export class CreateRedemptionRequestDto {
  storeItemId!: number;
}
