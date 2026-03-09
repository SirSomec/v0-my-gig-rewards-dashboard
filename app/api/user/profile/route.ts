import { NextRequest, NextResponse } from "next/server"

const MYGIG_BASE = (process.env.NEXT_PUBLIC_MYGIG_API_URL ?? "").trim().replace(/\/$/, "")

export async function GET(request: NextRequest) {
  if (!MYGIG_BASE) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_MYGIG_API_URL не задан" },
      { status: 500 }
    )
  }
  const auth = request.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Неавторизованный запрос" }, { status: 401 })
  }
  try {
    const res = await fetch(`${MYGIG_BASE}/user/profile`, {
      method: "GET",
      headers: { Authorization: auth },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка запроса к MyGig API"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
