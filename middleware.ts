import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ADMIN_LOGIN = "/admin/login"
const COOKIE_NAME = "admin_panel_unlocked"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  // Страница входа — пропускаем
  if (pathname === ADMIN_LOGIN) {
    return NextResponse.next()
  }

  // Всегда требуем cookie для доступа в админку (независимо от пользователя ЛК).
  // Cookie выставляется только после успешной проверки пароля на /admin/login (или без пароля, если ADMIN_PANEL_PASSWORD не задан).
  const cookie = request.cookies.get(COOKIE_NAME)
  if (cookie?.value) {
    return NextResponse.next()
  }

  const loginUrl = new URL(ADMIN_LOGIN, request.url)
  loginUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*"],
}
