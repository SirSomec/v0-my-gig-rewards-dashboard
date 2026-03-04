export class QuestResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  period!: string;
  progress!: number;
  total!: number;
  reward!: number;
  icon!: string;
  completed!: boolean;
}
