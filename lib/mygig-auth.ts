/**
 * Авторизация и профиль через MyGig API.
 * URL задаётся через NEXT_PUBLIC_MYGIG_API_URL.
 * Токен хранится в том же хранилище, что и для rewards-api (один токен для дашборда).
 */

import { getToken, setToken, clearToken } from "./rewards-api"
import type { MeResponse } from "./rewards-api"

const getBaseUrl = (): string => {
  const raw =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_MYGIG_API_URL ?? "")
      : (process.env.NEXT_PUBLIC_MYGIG_API_URL ?? "")
  const url = typeof raw === "string" ? raw.trim() : ""
  return url.replace(/\/$/, "")
}

const AUTH_ERROR =
  "NEXT_PUBLIC_MYGIG_API_URL не задан. Добавьте в .env в корне проекта строку NEXT_PUBLIC_MYGIG_API_URL=https://main.test09.mygig.ru и перезапустите npm run dev."

/** Включена ли авторизация через MyGig (задан URL). */
export function getMyGigApiUrl(): string | null {
  const url = getBaseUrl()
  return url || null
}

export function isMyGigAuthEnabled(): boolean {
  return !!getMyGigApiUrl()
}

// --- Ответы API MyGig (минимальные типы по документации) ---

export interface AuthPhoneResponse {
  ok: boolean
  mode?: "call" | "sms"
  betweenLimiterTime?: number
  /** Код для разработки (тестовые окружения), подставляем в поле кода. */
  DEV_MODE?: number
}

export interface AuthPhoneError {
  error?: string
  payload?: { type?: string; data?: { waitSeconds?: number; time?: number } }
}

export interface AuthCodeResponse {
  token: string
  role: string
  isFirstLogin?: boolean
  firstname?: string
  lastname?: string
  profileId?: string
}

export interface AuthCodeError {
  error?: string
}

/** Минимальная схема GET /user/profile (поля, используемые в дашборде). */
export interface UserProfile {
  user?: string
  _id?: string
  full_name?: string | null
  firstname?: string | null
  lastname?: string | null
  middlename?: string | null
  phone?: number | null
  role?: string
  balance?: number | null
  potentialBalance?: number | null
  countJobs?: { all?: number; confirmed?: number; notConfirmed?: number } | null
  analytics?: {
    totalJobsBooked?: number
    totalJobsDone?: number
    totalEarned?: number
    totalPayments?: number
    rating?: number
  } | null
  avatar?: Array<{ _id?: string; filename?: string; deleted?: boolean }> | null
  status?: string | null
  [key: string]: unknown
}

// --- Моковые значения для полей профиля, если пришли null ---

const MOCK = {
  userName: "Пользователь",
  levelName: "Новичок",
  nextLevelName: "Бронза",
  shiftsRequired: 5,
  nextLevelShiftsRequired: 10,
  balance: 0,
  strikesCountWeek: 0,
  strikesCountMonth: 0,
  strikesLimitPerWeek: 3,
  strikesLimitPerMonth: 5,
}

// --- Запросы к MyGig API ---

async function fetchMyGig<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const base = getBaseUrl()
  if (!base) throw new Error(AUTH_ERROR)
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  }
  if (!options?.skipAuth) {
    const token = getToken()
    if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    clearToken()
    throw new Error("Сессия истекла. Войдите снова.")
  }
  const text = await res.text()
  if (!res.ok) {
    let errMsg = `MyGig API ${res.status}: ${text || res.statusText}`
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }
  if (!text) return {} as T
  return JSON.parse(text) as T
}

/** Запрос кода: POST /auth/phone. Идёт через наш API (/api/auth/phone), чтобы избежать CORS. */
export async function authPhone(phone: string): Promise<AuthPhoneResponse & AuthPhoneError> {
  const normalized = phone.replace(/\D/g, "")
  const num = normalized.startsWith("7") ? parseInt(normalized, 10) : parseInt(`7${normalized}`, 10)
  if (Number.isNaN(num) || num < 79000000000) throw new Error("Введите корректный номер телефона")
  const res = await fetch("/api/auth/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: num }),
  })
  const data = (await res.json()) as AuthPhoneResponse & AuthPhoneError
  if (!res.ok) {
    throw new Error((data as AuthPhoneError).error ?? `Ошибка запроса кода: ${res.status}`)
  }
  return data as AuthPhoneResponse & AuthPhoneError
}

/** Подтверждение кода: POST /auth/code. Идёт через наш API (/api/auth/code). Телефон — строка. Только роль worker. */
export async function authCode(phone: string, code: string): Promise<AuthCodeResponse> {
  const base = getBaseUrl()
  if (!base) throw new Error(AUTH_ERROR)
  const phoneStr = phone.replace(/\D/g, "").replace(/^8/, "7")
  const body = { phone: phoneStr.length === 11 ? phoneStr : `7${phoneStr}`, code }
  const res = await fetch("/api/auth/code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as AuthCodeResponse & AuthCodeError
  if (!res.ok) {
    throw new Error(data.error ?? "Неверный код. Попробуйте снова.")
  }
  if (data.role !== "worker") {
    throw new Error("Доступ только для исполнителей (worker). Ваша роль: " + (data.role ?? "не определена"))
  }
  if (data.token) setToken(data.token)
  return data
}

/**
 * Синхронизация пользователя с нашей БД при первом входе через MyGig.
 * Вызывает /api/auth/sync-user с текущим (MyGig) токеном, возвращает наш JWT для дашборда.
 * После успешного authCode() нужно вызвать эту функцию и сохранить результат в setToken() из rewards-api.
 */
export async function syncUserAndGetRewardsToken(): Promise<string> {
  const token = getToken()
  if (!token) throw new Error("Сначала выполните вход (authCode)")
  const res = await fetch("/api/auth/sync-user", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json()) as { accessToken?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Ошибка синхронизации: ${res.status}`)
  }
  if (!data.accessToken) throw new Error("Сервер не вернул токен дашборда")
  return data.accessToken
}

/** Профиль пользователя: GET /user/profile. Идёт через наш API (/api/user/profile), чтобы избежать CORS. */
export async function fetchUserProfile(): Promise<UserProfile> {
  const token = getToken()
  if (!token) throw new Error("Сессия истекла. Войдите снова.")
  const base = getBaseUrl()
  if (!base) throw new Error(AUTH_ERROR)
  const res = await fetch("/api/user/profile", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error("Сессия истекла. Войдите снова.")
  }
  const text = await res.text()
  if (!res.ok) {
    let errMsg = `Профиль: ${text || res.statusText}`
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }
  if (!text) return {} as UserProfile
  return JSON.parse(text) as UserProfile
}

/** Преобразует профиль MyGig в формат MeResponse (rewards-api) с подстановкой моков для null. */
export function mapProfileToMeResponse(profile: UserProfile): MeResponse {
  const firstName = profile.firstname ?? ""
  const lastName = profile.lastname ?? ""
  const fullName = profile.full_name?.trim() || [lastName, firstName].filter(Boolean).join(" ").trim() || null
  const shiftsCompleted = profile.analytics?.totalJobsBooked ?? profile.countJobs?.confirmed ?? profile.countJobs?.all ?? 0
  const shiftsRequired = MOCK.shiftsRequired
  const nextLevelShiftsRequired = MOCK.nextLevelShiftsRequired
  const shiftsRemaining = Math.max(0, nextLevelShiftsRequired - shiftsCompleted)

  let avatarUrl: string | null = null
  if (Array.isArray(profile.avatar) && profile.avatar.length > 0) {
    const first = profile.avatar.find((a) => !a.deleted && a.filename)
    if (first?.filename) {
      const base = getBaseUrl()
      avatarUrl = base ? `${base}/user/${profile.user ?? profile._id}/avatar` : null
    }
  }

  return {
    id: 0,
    name: fullName ?? MOCK.userName,
    email: null,
    avatarUrl,
    balance: profile.balance ?? MOCK.balance,
    levelId: 0,
    levelName: MOCK.levelName,
    nextLevelName: MOCK.nextLevelName,
    nextLevelShiftsRequired,
    shiftsCompleted,
    shiftsRequired,
    strikesCountWeek: MOCK.strikesCountWeek,
    strikesCountMonth: MOCK.strikesCountMonth,
    strikesLimitPerWeek: MOCK.strikesLimitPerWeek,
    strikesLimitPerMonth: MOCK.strikesLimitPerMonth,
  }
}
