/**
 * Клиент админ-API. Все запросы отправляют заголовок X-Admin-Key.
 * В development при отсутствии ключа бэкенд может разрешать доступ.
 */

const getBaseUrl = (): string =>
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001")
    : process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001";

const getAdminKey = (): string =>
  process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

function headers(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = getAdminKey();
  if (key) h["X-Admin-Key"] = key;
  return h;
}

async function fetchAdmin<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...options, headers: { ...headers(), ...options?.headers } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AdminUser {
  id: number;
  name: string | null;
  email: string | null;
  balance: number;
  shiftsCompleted: number;
  levelId: number;
  levelName: string | null;
}

export interface AdminRedemption {
  id: number;
  userId: number;
  userName: string | null;
  storeItemId: number;
  itemName: string;
  status: string;
  coinsSpent: number;
  createdAt: string;
  processedAt: string | null;
  notes: string | null;
}

export interface AdminLevel {
  id: number;
  name: string;
  shiftsRequired: number;
  strikeLimitPerWeek: number | null;
  strikeLimitPerMonth: number | null;
  sortOrder: number;
  perks?: Array<{ title: string; description?: string }>;
}

export interface AdminStoreItem {
  id: number;
  name: string;
  description: string | null;
  category: string;
  cost: number;
  icon: string;
  stockLimit: number | null;
  visibleFrom: string | null;
  visibleUntil: string | null;
  isActive: number;
  sortOrder: number;
  visibilityRules?: Record<string, unknown> | null;
}

export type CreateStoreItemBody = {
  name: string;
  description?: string;
  category: string;
  cost: number;
  icon?: string;
  stockLimit?: number;
  visibleFrom?: string;
  visibleUntil?: string;
  isActive?: number;
  sortOrder?: number;
  visibilityRules?: Record<string, unknown>;
};

export type UpdateStoreItemBody = Partial<CreateStoreItemBody>;

export type UpdateLevelBody = {
  name?: string;
  shiftsRequired?: number;
  strikeLimitPerWeek?: number | null;
  strikeLimitPerMonth?: number | null;
  perks?: Array<{ title: string; description?: string }>;
  sortOrder?: number;
};

export interface AdminQuest {
  id: number;
  name: string;
  description: string | null;
  period: string;
  conditionType: string;
  conditionConfig: Record<string, unknown> | null;
  rewardCoins: number;
  icon: string | null;
  isActive: number;
  isOneTime: number;
  activeFrom: string | null;
  activeUntil: string | null;
  targetType: string | null;
  targetGroupId: number | null;
}

export type CreateQuestBody = {
  name: string;
  description?: string;
  period: "daily" | "weekly" | "monthly";
  conditionType: string;
  conditionConfig?: Record<string, unknown>;
  rewardCoins: number;
  icon?: string;
  isActive?: number;
  isOneTime?: number;
  /** Отключить квест в конце текущего периода */
  activeUntilEndOfPeriod?: boolean;
  activeFrom?: string;
  activeUntil?: string;
  targetType?: "all" | "group";
  targetGroupId?: number | null;
};

export type UpdateQuestBody = Partial<CreateQuestBody>;

export async function adminListUsers(search?: string, limit?: number): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (limit) params.set("limit", String(limit));
  return fetchAdmin<AdminUser[]>(`/v1/admin/users?${params}`);
}

export async function adminGetUser(id: number): Promise<Record<string, unknown>> {
  return fetchAdmin<Record<string, unknown>>(`/v1/admin/users/${id}`);
}

export async function adminUpdateUserLevel(
  id: number,
  levelId: number
): Promise<{ id: number; levelId: number }> {
  return fetchAdmin(`/v1/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ levelId }),
  });
}

export async function adminManualTransaction(body: {
  userId: number;
  amount: number;
  type: "manual_credit" | "manual_debit";
  title?: string;
  description?: string;
}): Promise<{ transactionId: number; newBalance: number }> {
  return fetchAdmin("/v1/admin/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminListRedemptions(params?: {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  items: AdminRedemption[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.status != null) searchParams.set("status", params.status);
  if (params?.search != null) searchParams.set("search", params.search);
  if (params?.dateFrom != null) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo != null) searchParams.set("dateTo", params.dateTo);
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.pageSize != null) searchParams.set("pageSize", String(params.pageSize));
  const q = searchParams.toString();
  return fetchAdmin(`/v1/admin/redemptions${q ? `?${q}` : ""}`);
}

export async function adminBulkUpdateRedemptions(
  ids: number[],
  status: "fulfilled" | "cancelled",
  options?: { notes?: string; returnCoins?: boolean }
): Promise<{ updated: number; errors: Array<{ id: number; reason: string }> }> {
  return fetchAdmin("/v1/admin/redemptions/bulk-update", {
    method: "POST",
    body: JSON.stringify({ ids, status, ...options }),
  });
}

export async function adminUpdateRedemption(
  id: number,
  status: "fulfilled" | "cancelled",
  options?: { notes?: string; returnCoins?: boolean }
): Promise<{ id: number; status: string }> {
  return fetchAdmin(`/v1/admin/redemptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...options }),
  });
}

export async function adminListLevels(): Promise<AdminLevel[]> {
  return fetchAdmin<AdminLevel[]>("/v1/admin/levels");
}

export async function adminListStoreItems(): Promise<AdminStoreItem[]> {
  return fetchAdmin<AdminStoreItem[]>("/v1/admin/store-items");
}

export async function adminCreateStoreItem(
  body: CreateStoreItemBody
): Promise<{ id: number }> {
  return fetchAdmin("/v1/admin/store-items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminUpdateStoreItem(
  id: number,
  body: UpdateStoreItemBody
): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/store-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminDeleteStoreItem(id: number): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/store-items/${id}`, {
    method: "DELETE",
  });
}

export async function adminUpdateLevel(
  id: number,
  body: UpdateLevelBody
): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/levels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminListQuests(): Promise<AdminQuest[]> {
  return fetchAdmin<AdminQuest[]>("/v1/admin/quests");
}

export async function adminCreateQuest(
  body: CreateQuestBody
): Promise<{ id: number }> {
  return fetchAdmin("/v1/admin/quests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminUpdateQuest(
  id: number,
  body: UpdateQuestBody
): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/quests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminDeleteQuest(id: number): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/quests/${id}`, {
    method: "DELETE",
  });
}

export async function adminRecordShift(body: {
  userId: number;
  coins: number;
  title?: string;
  location?: string;
  clientId?: string;
  category?: string;
  hours?: number;
}): Promise<{ transactionId: number }> {
  return fetchAdmin("/v1/admin/shifts/complete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminRegisterStrike(body: {
  userId: number;
  type: "no_show" | "late_cancel";
  shiftExternalId?: string;
}): Promise<{ strikeId: number; levelDemoted: boolean }> {
  return fetchAdmin("/v1/admin/strikes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminRemoveStrike(
  strikeId: number,
  reason: string
): Promise<{ id: number; userId: number }> {
  return fetchAdmin(`/v1/admin/strikes/${strikeId}/remove`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface AdminAuditEntry {
  id: number;
  adminId: number | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export async function adminListAuditLog(params?: {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
}): Promise<{
  items: AdminAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.pageSize != null) searchParams.set("pageSize", String(params.pageSize));
  if (params?.action != null) searchParams.set("action", params.action);
  if (params?.entityType != null) searchParams.set("entityType", params.entityType);
  const q = searchParams.toString();
  return fetchAdmin(`/v1/admin/audit-log${q ? `?${q}` : ""}`);
}
