import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Админ-панель вынесена в отдельное приложение (admin-app). Редиректы и защита /admin больше не нужны.
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
