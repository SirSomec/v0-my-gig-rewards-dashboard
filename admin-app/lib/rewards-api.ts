/**
 * Минимальный клиент для функции «Сменить» в админке.
 * Переход в личный кабинет в той же вкладке с параметром userId для dev-входа.
 */

const getDashboardUrl = (): string =>
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"

/** Перейти в личный кабинет от имени пользователя (та же вкладка, без новой). */
export function switchDashboardToUser(userId: number): void {
  if (typeof window === "undefined") return
  const url = new URL(getDashboardUrl())
  url.searchParams.set("userId", String(userId))
  window.location.href = url.toString()
}
