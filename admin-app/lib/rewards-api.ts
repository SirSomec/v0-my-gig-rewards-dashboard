/**
 * Минимальный клиент для функции «Открыть кабинет» в админке.
 * Открывает основной дашборд с параметром userId для dev-входа.
 */

const getDashboardUrl = (): string =>
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000"

/** Открыть основной дашборд от имени пользователя (в новой вкладке). */
export function openDashboardAsUser(userId: number): void {
  if (typeof window === "undefined") return
  const url = new URL(getDashboardUrl())
  url.searchParams.set("userId", String(userId))
  window.open(url.toString(), "_blank", "noopener,noreferrer")
}
