export class QuestResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  period!: string;
  /** Единоразовый квест (выполняется один раз на пользователя) */
  isOneTime!: boolean;
  progress!: number;
  total!: number;
  reward!: number;
  icon!: string;
  completed!: boolean;
}
