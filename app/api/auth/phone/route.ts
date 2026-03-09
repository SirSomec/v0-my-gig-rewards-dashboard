import { NextRequest, NextResponse } from "next/server"

const MYGIG_BASE = (process.env.NEXT_PUBLIC_MYGIG_API_URL ?? "").trim().replace(/\/$/, "")

export async function POST(request: NextRequest) {
  if (!MYGIG_BASE) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_MYGIG_API_URL не задан" },
      { status: 500 }
    )
  }
  let body: { phone?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 })
  }
  const phone = body?.phone
  if (phone == null || typeof phone !== "number") {
    return NextResponse.json({ error: "Укажите номер телефона (phone)" }, { status: 400 })
  }
  try {
    const res = await fetch(`${MYGIG_BASE}/auth/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка запроса к MyGig API"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
