import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "admin_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 дней

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001"

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Неверный формат запроса." },
      { status: 400 }
    )
  }

  const email = typeof body.email === "string" ? body.email.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  const apiUrl = getApiUrl()
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json(
      { error: data.message ?? "Ошибка входа" },
      { status: res.status }
    )
  }

  const token = data.token
  const user = data.user
  if (!token || !user) {
    return NextResponse.json(
      { error: "Некорректный ответ сервера" },
      { status: 502 }
    )
  }

  const response = NextResponse.json({ ok: true, user })
  const isSecure = request.nextUrl.protocol === "https:"
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
  return response
}
