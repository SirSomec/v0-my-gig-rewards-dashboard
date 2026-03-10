import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const LOGIN_PATH = "/login"
const COOKIE_NAME = "admin_session"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === LOGIN_PATH) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(COOKIE_NAME)
  if (cookie?.value) {
    return NextResponse.next()
  }

  const loginUrl = new URL(LOGIN_PATH, request.url)
  loginUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
