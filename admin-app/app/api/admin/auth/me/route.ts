import { NextRequest, NextResponse } from "next/server"

const getApiUrl = () =>
  process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001"

export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value
  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  const apiUrl = getApiUrl()
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/v1/admin/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  const user = await res.json().catch(() => null)
  return NextResponse.json({ user })
}
