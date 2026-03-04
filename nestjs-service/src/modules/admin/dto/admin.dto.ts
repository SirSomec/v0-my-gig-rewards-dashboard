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
  strikeThreshold?: number | null;
  perks?: Array<{ title: string; description?: string }>;
  sortOrder?: number;
}
