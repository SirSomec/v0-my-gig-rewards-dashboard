import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "admin_panel_unlocked"
const COOKIE_VALUE = "1"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 дней

export async function POST(request: NextRequest) {
  const expected = process.env.ADMIN_PANEL_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: "Защита панели не включена (ADMIN_PANEL_PASSWORD не задан)." },
      { status: 503 }
    )
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Неверный формат запроса." },
      { status: 400 }
    )
  }

  const password = typeof body.password === "string" ? body.password.trim() : ""
  if (password !== expected) {
    return NextResponse.json(
      { error: "Неверный пароль." },
      { status: 401 }
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: COOKIE_MAX_AGE,
  })
  return res
}
