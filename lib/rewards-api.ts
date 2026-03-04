/**
 * Клиент API дашборда наград (nestjs-service RewardsModule).
 * В dev-режиме: dev-login даёт JWT, токен хранится в localStorage и передаётся в запросах.
 */

const TOKEN_STORAGE_KEY = "rewards_access_token";

const getBaseUrl = (): string =>
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001")
    : process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001";

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
  shiftsCompleted: number;
  shiftsRequired: number;
  strikesCount: number;
  strikesThreshold: number | null;
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
  progress: number;
  total: number;
  reward: number;
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

export async function fetchQuests(): Promise<QuestResponse[]> {
  const url = buildUrl("/v1/rewards/quests");
  return fetchApi<QuestResponse[]>(url);
}

export async function fetchStore(): Promise<StoreItemResponse[]> {
  const url = buildUrl("/v1/rewards/store");
  return fetchApi<StoreItemResponse[]>(url);
}

export async function createRedemption(storeItemId: number): Promise<CreateRedemptionResponse> {
  const url = buildUrl("/v1/rewards/redemptions");
  return fetchApi<CreateRedemptionResponse>(url, {
    method: "POST",
    body: JSON.stringify({ storeItemId }),
  });
}

export function getDevUserId(): string | null {
  return getDevUserIdEnv();
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
