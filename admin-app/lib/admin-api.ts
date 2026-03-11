/**
 * Клиент админ-API. В браузере запросы идут через прокси /api/admin/proxy с cookie (JWT);
 * на сервере — напрямую к бэкенду с X-Admin-Key.
 */

const getBaseUrl = (): string =>
  typeof window !== "undefined"
    ? "/api/admin/proxy"
    : (process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001");

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
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { ...headers(), ...(options?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Ключи прав доступа к разделам админ-панели (совпадают с бэкендом). */
export const ADMIN_PERMISSION_KEYS = [
  "overview",
  "users",
  "redemptions",
  "store",
  "quests",
  "user_groups",
  "quest_moderation",
  "levels",
  "settings",
  "balance",
  "audit",
  "admin_users",
  "mock_toj",
  "dev",
  "etl_explorer",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export interface AdminSessionUser {
  id: number | "super";
  email: string;
  name: string | null;
  isSuper: boolean;
  permissions: AdminPermissionKey[];
}

export interface AdminPanelUser {
  id: number;
  email: string;
  name: string | null;
  isActive: number;
  permissions: AdminPermissionKey[];
}

export async function adminAuthMe(): Promise<AdminSessionUser | null> {
  const res = await fetch("/api/admin/auth/me", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  return data.user ?? null;
}

export async function adminListAdminUsers(): Promise<AdminPanelUser[]> {
  return fetchAdmin<AdminPanelUser[]>("/v1/admin/admin-users");
}

export async function adminCreateAdminUser(body: {
  email: string;
  password: string;
  name?: string | null;
  permissions?: AdminPermissionKey[];
}): Promise<{ id: number }> {
  return fetchAdmin("/v1/admin/admin-users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminUpdateAdminUser(
  id: number,
  body: {
    name?: string | null;
    isActive?: number;
    permissions?: AdminPermissionKey[];
    password?: string | null;
  }
): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/admin-users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminDeleteAdminUser(id: number): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/admin-users/${id}`, {
    method: "DELETE",
  });
}

export interface AdminUser {
  id: number;
  name: string | null;
  email: string | null;
  externalId?: string | null;
  balance: number;
  shiftsCompleted: number;
  levelId: number;
  levelName: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  bonusMultiplier?: number;
  perks?: Array<{ title: string; description?: string; icon?: string }>;
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
  /** Сколько уже выкуплено (pending + fulfilled) по этому товару. Может не приходить из API. */
  redeemedCount?: number;
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
  perks?: Array<{ title: string; description?: string; icon?: string }>;
  sortOrder?: number;
  bonusMultiplier?: number;
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
  activeUntilEndOfPeriod?: boolean;
  activeFrom?: string;
  activeUntil?: string;
  targetType?: "all" | "group";
  targetGroupId?: number | null;
};

export type UpdateQuestBody = Partial<CreateQuestBody>;

export async function adminListUsers(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminUser[]; total: number; page: number; pageSize: number }> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.pageSize != null) searchParams.set("pageSize", String(params.pageSize));
  const q = searchParams.toString();
  return fetchAdmin<{ items: AdminUser[]; total: number; page: number; pageSize: number }>(
    `/v1/admin/users${q ? `?${q}` : ""}`
  );
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

export interface EtlMgUser {
  _id: string;
  firstname: string;
  lastname: string;
}

export async function adminGetEtlUserByExternalId(
  externalId: string
): Promise<EtlMgUser> {
  const params = new URLSearchParams({ externalId });
  return fetchAdmin<EtlMgUser>(`/v1/admin/etl-explorer/user-by-id?${params}`);
}

export async function adminCreateUser(body: {
  externalId: string;
  name?: string;
  firstname?: string;
  lastname?: string;
}): Promise<{ id: number }> {
  return fetchAdmin("/v1/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
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

export interface CoinsOverviewDay {
  date: string;
  balanceAtEndOfDay: number;
  spentThatDay: number;
}

export async function adminGetCoinsOverview(days?: number): Promise<{
  totalBalanceToday: number;
  byDay: CoinsOverviewDay[];
}> {
  const params = days != null ? `?days=${days}` : "";
  return fetchAdmin(`/v1/admin/stats/coins-overview${params}`);
}

export interface PageViewsOverviewDay {
  date: string;
  views: number;
  uniqueUsers: number;
}

export interface PageViewsOverview {
  byDay: PageViewsOverviewDay[];
  byPath: Array<{ path: string; views: number }>;
  totalViews: number;
  totalUniqueUsers: number;
}

export async function adminGetPageViewsOverview(days?: number): Promise<PageViewsOverview> {
  const params = days != null ? `?days=${days}` : "";
  return fetchAdmin(`/v1/admin/stats/page-views-overview${params}`);
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

export async function adminGetBonusSettings(): Promise<{
  shiftBonusDefaultMultiplier: number;
  questMonthlyBonusCap: number;
}> {
  return fetchAdmin("/v1/admin/settings/bonus");
}

export async function adminUpdateBonusSettings(body: {
  shiftBonusDefaultMultiplier: number;
  questMonthlyBonusCap?: number;
}): Promise<{ shiftBonusDefaultMultiplier: number; questMonthlyBonusCap: number }> {
  return fetchAdmin("/v1/admin/settings/bonus", {
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

export interface AdminUserGroup {
  id: number;
  name: string;
  description: string | null;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserGroupMember {
  userId: number;
  userName: string | null;
  email: string | null;
  externalId: string | null;
}

export async function adminListUserGroups(): Promise<AdminUserGroup[]> {
  return fetchAdmin<AdminUserGroup[]>("/v1/admin/user-groups");
}

export async function adminGetUserGroup(id: number): Promise<AdminUserGroup> {
  return fetchAdmin<AdminUserGroup>(`/v1/admin/user-groups/${id}`);
}

export async function adminCreateUserGroup(body: {
  name: string;
  description?: string | null;
}): Promise<{ id: number }> {
  return fetchAdmin("/v1/admin/user-groups", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminUpdateUserGroup(
  id: number,
  body: { name?: string; description?: string | null }
): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/user-groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminDeleteUserGroup(id: number): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/user-groups/${id}`, {
    method: "DELETE",
  });
}

export async function adminListGroupMembers(groupId: number): Promise<{
  group: { id: number; name: string; description: string | null };
  items: AdminUserGroupMember[];
}> {
  return fetchAdmin(`/v1/admin/user-groups/${groupId}/members`);
}

export async function adminAddGroupMember(
  groupId: number,
  userId: number
): Promise<{ id: number; added: boolean }> {
  return fetchAdmin(`/v1/admin/user-groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function adminRemoveGroupMember(
  groupId: number,
  userId: number
): Promise<{ id: number }> {
  return fetchAdmin(`/v1/admin/user-groups/${groupId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function adminImportGroupMembers(
  groupId: number,
  identifiers: string[]
): Promise<{ added: number; totalRequested: number; resolved: number }> {
  return fetchAdmin(`/v1/admin/user-groups/${groupId}/members/import`, {
    method: "POST",
    body: JSON.stringify({ identifiers }),
  });
}

export async function adminCompleteManualQuestForUser(
  questId: number,
  userId: number
): Promise<{ completed: boolean; alreadyCompleted: boolean }> {
  return fetchAdmin(`/v1/admin/quests/${questId}/complete-for-user`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function adminRecordShift(body: {
  userId: number;
  coins?: number;
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
  /** Кто выполнил действие: email админа или «суперадмин» */
  adminDisplay?: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  /** external_id пользователя, если действие касается пользователя (entityType = user) */
  entityExternalId?: string | null;
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

export async function adminEtlExplorerStatus(): Promise<{
  configured: boolean;
  env?: Record<string, boolean>;
  processEnvEtlKeys?: string[];
}> {
  return fetchAdmin("/v1/admin/etl-explorer/status");
}

export async function adminEtlExplorerConnectionInfo(): Promise<{
  database: string;
  user: string;
}> {
  return fetchAdmin("/v1/admin/etl-explorer/connection-info");
}

export async function adminEtlExplorerDatabases(): Promise<{ datname: string }[]> {
  return fetchAdmin("/v1/admin/etl-explorer/databases");
}

export async function adminEtlExplorerIntro(): Promise<{
  connectionInfo: { database: string; user: string };
  databases: { datname: string }[];
  schemas: { schema_name: string }[];
}> {
  return fetchAdmin("/v1/admin/etl-explorer/intro");
}

export async function adminEtlExplorerSchemas(): Promise<{ schema_name: string }[]> {
  return fetchAdmin("/v1/admin/etl-explorer/schemas");
}

export async function adminEtlExplorerTables(schema: string): Promise<{ table_name: string }[]> {
  const q = new URLSearchParams({ schema });
  return fetchAdmin(`/v1/admin/etl-explorer/tables?${q}`);
}

export async function adminEtlExplorerColumns(
  schema: string,
  table: string
): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
  const q = new URLSearchParams({ schema, table });
  return fetchAdmin(`/v1/admin/etl-explorer/columns?${q}`);
}

export async function adminEtlExplorerPreview(
  schema: string,
  table: string,
  limit?: number
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ schema, table });
  if (limit != null) params.set("limit", String(limit));
  return fetchAdmin(`/v1/admin/etl-explorer/preview?${params}`);
}

export async function adminEtlExplorerQuery(sql: string): Promise<{
  rows: Record<string, unknown>[];
  limited: boolean;
}> {
  return fetchAdmin("/v1/admin/etl-explorer/query", {
    method: "POST",
    body: JSON.stringify({ sql }),
  });
}

export async function adminMockTojStatus(): Promise<{ configured: boolean }> {
  return fetchAdmin("/v1/admin/mock-toj/status");
}

export async function adminMockTojListJobs(params?: {
  limit?: number;
  skip?: number;
}): Promise<{ items: MockTojJob[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.skip != null) searchParams.set("skip", String(params.skip));
  const q = searchParams.toString();
  return fetchAdmin(`/v1/admin/mock-toj/jobs${q ? `?${q}` : ""}`);
}

export interface MockTojJob {
  _id: string;
  status?: string;
  workerId?: string;
  customName?: string;
  spec?: string;
  start?: string;
  finish?: string;
  startFact?: string;
  finishFact?: string;
  hours?: number;
  salaryPerHour?: number;
  paymentPerHour?: number;
  createdAt?: string;
  updatedAt?: string;
  statusChangeMeta?: {
    initiatorType?: string | null;
    initiator?: string | null;
    at?: string;
  } | null;
}

export async function adminMockTojUpdateJobStatus(
  jobId: string,
  body: { status: string; initiatorType?: string; initiator?: string }
): Promise<Record<string, unknown>> {
  return fetchAdmin(`/v1/admin/mock-toj/jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function adminMockTojGenerate(body: {
  userId: number;
  count?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ generated: number }> {
  return fetchAdmin("/v1/admin/mock-toj/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminMockTojCreateBookedJob(body: {
  workerId: string;
  start: string;
  finish?: string;
  customName?: string;
  spec?: string;
  clientId?: string;
  hours?: number;
}): Promise<{ job: MockTojJob }> {
  return fetchAdmin("/v1/admin/mock-toj/create-booked-job", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminTojSyncStatus(): Promise<{
  configured: boolean;
  syncEnabled: boolean;
}> {
  return fetchAdmin("/v1/admin/toj-sync/status");
}

export async function adminTojSyncRun(): Promise<{
  processed: number;
  skipped: number;
  lateCancelApplied?: number;
  noShowApplied?: number;
  bookedRecorded?: number;
  skippedReasons?: { noUser?: number; jobBeforeUser?: number; alreadySynced?: number; wrongStatus?: number };
  errors: string[];
  watermark?: string;
}> {
  return fetchAdmin("/v1/admin/toj-sync/run", { method: "POST" });
}
