import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "admin_session"
const getApiUrl = () =>
  process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, context, undefined)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, context, await request.text())
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, context, await request.text())
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  return proxy(request, context, undefined)
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
  body: string | undefined
) {
  const { path: pathSegments } = await context.params
  const path = Array.isArray(pathSegments) ? pathSegments.join("/") : ""
  if (!path) {
    return NextResponse.json({ error: "Path required" }, { status: 400 })
  }

  const token = request.cookies.get(COOKIE_NAME)?.value
  const apiUrl = getApiUrl().replace(/\/$/, "")
  const url = new URL(request.url)
  const target = `${apiUrl}/${path}${url.search}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_SECRET
  if (adminKey) headers["X-Admin-Key"] = adminKey

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: body ?? undefined,
  })

  const text = await res.text()
  try {
    const data = text ? JSON.parse(text) : null
    return NextResponse.json(data, { status: res.status })
  } catch {
    return new NextResponse(text, { status: res.status })
  }
}
