/**
 * DTO-классы для админ-API (обязательны для emitDecoratorMetadata в декорированных параметрах).
 */
export class CreateStoreItemDto {
  name!: string;
  description?: string;
  category!: string;
  cost!: number;
  icon?: string;
  stockLimit?: number;
  visibleFrom?: string;
  visibleUntil?: string;
  isActive?: number;
  sortOrder?: number;
  visibilityRules?: Record<string, unknown>;
}

export class UpdateStoreItemDto {
  name?: string;
  description?: string;
  category?: string;
  cost?: number;
  icon?: string;
  stockLimit?: number;
  visibleFrom?: string;
  visibleUntil?: string;
  isActive?: number;
  sortOrder?: number;
  visibilityRules?: Record<string, unknown>;
}

export class UpdateLevelDto {
  name?: string;
  shiftsRequired?: number;
  /** Лимит штрафов за неделю (при превышении — понижение уровня); null = не учитывать */
  strikeLimitPerWeek?: number | null;
  /** Лимит штрафов за месяц (при превышении — понижение уровня); null = не учитывать */
  strikeLimitPerMonth?: number | null;
  perks?: Array<{ title: string; description?: string }>;
  sortOrder?: number;
  /** Дополнительный множитель бонусов за смену для уровня (по умолчанию 1) */
  bonusMultiplier?: number;
}

export class CreateQuestDto {
  name!: string;
  description?: string;
  period!: 'daily' | 'weekly' | 'monthly';
  conditionType!: string;
  conditionConfig?: Record<string, unknown>;
  rewardCoins!: number;
  icon?: string;
  isActive?: number;
  /** Единоразовый квест (любой период) */
  isOneTime?: number;
  /** Квест отключится автоматически в конце текущего периода */
  activeUntilEndOfPeriod?: boolean;
  activeFrom?: string;
  activeUntil?: string;
  targetType?: 'all' | 'group';
  targetGroupId?: number | null;
}

export class UpdateQuestDto {
  name?: string;
  description?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  conditionType?: string;
  conditionConfig?: Record<string, unknown>;
  rewardCoins?: number;
  icon?: string;
  isActive?: number;
  isOneTime?: number;
  activeFrom?: string;
  activeUntil?: string;
  targetType?: 'all' | 'group';
  targetGroupId?: number | null;
}
