export class MeResponseDto {
  id!: number;
  name!: string | null;
  email!: string | null;
  avatarUrl!: string | null;
  balance!: number;
  levelId!: number;
  levelName!: string;
  nextLevelName!: string | null;
  shiftsCompleted!: number;
  shiftsRequired!: number;
  strikesCount!: number;
  strikesThreshold!: number | null; // null для бронзы
}
