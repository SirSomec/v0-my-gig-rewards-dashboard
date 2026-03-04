export class TransactionResponseDto {
  id!: number;
  amount!: number;
  type!: string;
  title!: string | null;
  description!: string | null;
  location!: string | null;
  createdAt!: string;
}
