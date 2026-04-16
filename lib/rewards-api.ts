/**
 * Клиент API дашборда наград (nestjs-service RewardsModule).
 * В dev-режиме: dev-login даёт JWT, токен хранится в localStorage и передаётся в запросах.
 */

const TOKEN_STORAGE_KEY = "rewards_access_token";
/** На время разработки: под каким пользователем открывать кабинет (выбор в админке). */
const VIEW_AS_USER_ID_KEY = "rewards_dev_view_user_id";

const getBaseUrl = (): string =>
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001")
    : process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001";

/** URL картинки приза: относительные пути API (`/v1/uploads/...`) дополняются базой Rewards API. */
export function resolveRewardsMediaUrl(url: string | null | undefined): string {
  if (url == null || url === "") return ""
  if (url.startsWith("data:") || /^https?:\/\//i.test(url)) return url
  const base = getBaseUrl().replace(/\/$/, "")
  const path = url.startsWith("/") ? url : `/${url}`
  return `${base}${path}`
}

const getDevUserIdEnv = (): string | null =>
  process.env.NEXT_PUBLIC_DEV_USER_ID ?? null;

/** Для отображения в UI при ошибке (проверка настроек). Вызывать только на клиенте. */
export function getApiConfigForDisplay(): { apiUrl: string; hasDevUserId: boolean } {
  return {
    apiUrl: getBaseUrl(),
    hasDevUserId: !!getDevUserIdEnv(),
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(accessToken: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** Полная деавторизация: удаляет JWT и «просмотр от имени» на текущем устройстве. */
export function clearAllAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(VIEW_AS_USER_ID_KEY);
}

function buildUrl(
  path: string,
  params?: Record<string, string>,
  options?: { skipUserIdQuery?: boolean },
): string {
  const base = getBaseUrl().replace(/\/$/, "");
  const pathNorm = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(pathNorm, base);
  const hasToken = getToken();
  const userId = getDevUserIdEnv();
  if (!options?.skipUserIdQuery && !hasToken && userId) {
    url.searchParams.set("userId", userId);
  }
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error("Сессия истекла. Войдите снова.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// --- Типы ответов API (совместимы с бэкендом) ---

export interface MeResponse {
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  balance: number;
  levelId: number;
  levelName: string;
  nextLevelName: string | null;
  /** Порог смен следующего уровня (для перехода). null = максимальный уровень. */
  nextLevelShiftsRequired: number | null;
  shiftsCompleted: number;
  shiftsRequired: number;
  /** Минимум смен за календарный месяц (UTC) для сохранения текущего уровня; null = без требования */
  currentLevelMonthlyShiftsRequiredToKeep: number | null;
  /** Сколько смен выполнено в текущем календарном месяце (UTC). */
  monthlyShiftsCompletedCurrentMonth: number;
  /** Рейтинг надёжности 0–5 (дробное). По умолчанию 4. */
  reliabilityRating: number;
  reliabilityRatingIncreasePerShift: number;
  reliabilityRatingDecreaseNoShow: number;
  reliabilityRatingDecreaseLateCancel: number;
  reliabilityMinRatingToCountShiftForLevel: number;
  reliabilityMinRatingToUpgradeLevel: number;
  reliabilityCountsShiftsForLevel: boolean;
  reliabilityAllowsLevelUpgrade: boolean;
  /** Сумма начисленных бонусов за текущий месяц (смены + квесты) */
  monthlyBonusTotal?: number;
  /** Порог бонусов за месяц (0 = без ограничения) */
  questMonthlyBonusCap?: number;
  /** true, если новые квесты ограничены до конца месяца из‑за достижения порога */
  questsLimitedByCap?: boolean;
  /** Статус участия в программе лояльности: active | pending */
  loyaltyStatus?: 'active' | 'pending';
  /** Когда пользователь нажал «Зарегистрироваться» (ISO); null — ещё не нажал */
  loyaltyRequestedAt?: string | null;
}

export interface TransactionResponse {
  id: number;
  amount: number;
  type: string;
  title: string | null;
  description: string | null;
  location: string | null;
  createdAt: string;
}

export interface QuestResponse {
  id: number;
  name: string;
  description: string | null;
  period: string;
  isOneTime: boolean;
  progress: number;
  total: number;
  reward: number;
  /** Прирост рейтинга надёжности при выполнении квеста */
  rewardReliabilityRating?: number;
  icon: string;
  completed: boolean;
}

export interface StoreItemResponse {
  id: number;
  name: string;
  description: string | null;
  category: string;
  cost: number;
  icon: string;
  /** Общий лимит (тираж). null = без лимита */
  stockLimit?: number | null;
  /** Сколько уже выкуплено (pending + fulfilled) */
  redeemedCount?: number;
}

export interface RedemptionResponse {
  id: number;
  storeItemId: number;
  itemName: string;
  itemCategory: string;
  itemIcon: string;
  status: "pending" | "fulfilled" | "cancelled";
  coinsSpent: number;
  createdAt: string;
  processedAt: string | null;
  notes: string | null;
}

export interface LevelResponse {
  id: number;
  name: string;
  shiftsRequired: number;
  monthlyShiftsRequiredToKeep: number | null;
  perks: Array<{ title: string; description?: string; icon?: string }>;
  sortOrder: number;
}

export interface RafflePrizeResponse {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  quantity: number;
  sortOrder: number;
}

export interface RaffleWinnerResponse {
  id: number;
  prizeId: number;
  prizeTitle: string;
  userId: number;
  userName: string | null;
  ticketId: number;
  ticketNumber: number;
  selectedAt: string;
}

export interface RaffleResponse {
  id: number;
  title: string;
  description: string | null;
  status: "draft" | "active" | "drawing" | "completed" | "completed_without_entries" | "cancelled";
  ticketPrice: number;
  maxTicketsPerUser: number | null;
  winnersCount: number;
  coverImageUrl: string | null;
  isVisible: boolean;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  totalTickets: number;
  myTicketsCount: number;
  prizes: RafflePrizeResponse[];
  winners: RaffleWinnerResponse[];
}

export interface MyRaffleEntryResponse {
  raffleId: number;
  raffleTitle: string;
  status: RaffleResponse["status"];
  ticketPrice: number;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  ticketsCount: number;
  ticketNumbers: number[];
  prizes: RafflePrizeResponse[];
  winners: RaffleWinnerResponse[];
  isWinner: boolean;
}

export interface PurchaseRaffleTicketsResponse {
  raffleId: number;
  ticketsPurchased: number;
  ticketIds: number[];
  ticketNumbers: number[];
}

export interface CreateRedemptionResponse {
  redemptionId: number;
}

export interface DevLoginResponse {
  accessToken: string;
}

// --- Auth (dev) ---

export async function devLogin(userId: number): Promise<DevLoginResponse> {
  const base = getBaseUrl().replace(/\/$/, "");
  const url = `${base}/v1/auth/dev-login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dev login failed: ${res.status} ${text || res.statusText}`);
  }
  const data = (await res.json()) as DevLoginResponse;
  if (data.accessToken) setToken(data.accessToken);
  return data;
}

// --- Вызовы API ---

export async function fetchMe(): Promise<MeResponse> {
  const url = buildUrl("/v1/rewards/me");
  return fetchApi<MeResponse>(url);
}

export async function fetchTransactions(limit = 50): Promise<TransactionResponse[]> {
  const url = buildUrl("/v1/rewards/transactions", { limit: String(limit) });
  return fetchApi<TransactionResponse[]>(url);
}

export interface StrikeResponse {
  id: number;
  type: string;
  shiftExternalId: string | null;
  occurredAt: string;
  removedAt: string | null;
}

export interface ReliabilityRatingLogResponse {
  id: number;
  previousRating: number;
  newRating: number;
  delta: number;
  reason: string;
  createdAt: string;
}

export async function fetchStrikes(limit = 50): Promise<StrikeResponse[]> {
  const url = buildUrl("/v1/rewards/strikes", { limit: String(limit) });
  return fetchApi<StrikeResponse[]>(url);
}

export async function fetchReliabilityRatingLog(limit = 10): Promise<ReliabilityRatingLogResponse[]> {
  const url = buildUrl("/v1/rewards/reliability-rating-log", { limit: String(limit) });
  return fetchApi<ReliabilityRatingLogResponse[]>(url);
}

export async function fetchQuests(): Promise<QuestResponse[]> {
  const url = buildUrl("/v1/rewards/quests");
  return fetchApi<QuestResponse[]>(url);
}

export async function fetchStore(): Promise<StoreItemResponse[]> {
  const url = buildUrl("/v1/rewards/store");
  return fetchApi<StoreItemResponse[]>(url);
}

export async function fetchRedemptions(): Promise<RedemptionResponse[]> {
  const url = buildUrl("/v1/rewards/redemptions");
  return fetchApi<RedemptionResponse[]>(url);
}

export async function fetchLevels(): Promise<LevelResponse[]> {
  const url = buildUrl("/v1/rewards/levels");
  return fetchApi<LevelResponse[]>(url);
}

export async function fetchRaffles(): Promise<RaffleResponse[]> {
  const url = buildUrl("/v1/rewards/raffles");
  return fetchApi<RaffleResponse[]>(url);
}

export async function fetchMyRaffles(): Promise<MyRaffleEntryResponse[]> {
  const url = buildUrl("/v1/rewards/my-raffles");
  return fetchApi<MyRaffleEntryResponse[]>(url);
}

export async function purchaseRaffleTickets(
  raffleId: number,
  quantity = 1,
): Promise<PurchaseRaffleTicketsResponse> {
  const url = buildUrl(`/v1/rewards/raffles/${raffleId}/tickets`);
  return fetchApi<PurchaseRaffleTicketsResponse>(url, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  });
}

export async function createRedemption(storeItemId: number): Promise<CreateRedemptionResponse> {
  const url = buildUrl("/v1/rewards/redemptions");
  return fetchApi<CreateRedemptionResponse>(url, {
    method: "POST",
    body: JSON.stringify({ storeItemId }),
  });
}

/** Отправить заявку на участие в программе (принять условия и нажать «Зарегистрироваться»). */
export async function submitLoyaltyRequest(): Promise<{ accepted: boolean }> {
  const url = buildUrl("/v1/rewards/loyalty/request");
  return fetchApi<{ accepted: boolean }>(url, { method: "POST" });
}

/** Записать просмотр вкладки (для аналитики посещаемости в админке). Вызывать при смене вкладки. */
export async function recordPageView(path: string): Promise<void> {
  const url = buildUrl("/v1/rewards/page-view");
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    credentials: "same-origin",
    body: JSON.stringify({ path: path || "home" }),
  }).catch(() => { /* игнорируем ошибки трекинга */ });
}

/** ID пользователя для отображения кабинета: сначала из выбора в админке (localStorage), затем из env. */
export function getDevUserId(): string | null {
  if (typeof window !== "undefined") {
    const viewAs = localStorage.getItem(VIEW_AS_USER_ID_KEY);
    if (viewAs) return viewAs;
  }
  return getDevUserIdEnv();
}

/** Установить/сбросить «просмотр кабинета от имени пользователя» (для разработки в админке). */
export function setViewAsUserId(userId: number | null): void {
  if (typeof window === "undefined") return;
  if (userId == null) localStorage.removeItem(VIEW_AS_USER_ID_KEY);
  else localStorage.setItem(VIEW_AS_USER_ID_KEY, String(userId));
}

/** Текущий выбранный «view as» id (только для отображения в UI). */
export function getViewAsUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VIEW_AS_USER_ID_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
