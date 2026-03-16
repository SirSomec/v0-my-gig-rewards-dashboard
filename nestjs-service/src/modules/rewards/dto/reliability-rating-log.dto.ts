export class ReliabilityRatingLogResponseDto {
  id!: number;
  previousRating!: number;
  newRating!: number;
  delta!: number;
  reason!: string;
  createdAt!: string;
}
