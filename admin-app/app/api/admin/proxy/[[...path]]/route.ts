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
  const body = await request.arrayBuffer()
  return proxy(request, context, body.byteLength === 0 ? undefined : body)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const body = await request.arrayBuffer()
  return proxy(request, context, body.byteLength === 0 ? undefined : body)
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
  body: ArrayBuffer | undefined
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
  const headers: Record<string, string> = {}
  const incomingCt = request.headers.get("content-type")
  if (incomingCt) {
    headers["Content-Type"] = incomingCt
  } else if (body != null && body.byteLength > 0) {
    headers["Content-Type"] = "application/json"
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_SECRET
  if (adminKey) headers["X-Admin-Key"] = adminKey

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: body ?? undefined,
  })

  const contentType = res.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const text = await res.text()
    try {
      const data = text ? JSON.parse(text) : null
      return NextResponse.json(data, { status: res.status })
    } catch {
      return new NextResponse(text, { status: res.status })
    }
  }

  const outBody = await res.arrayBuffer()
  const outHeaders = new Headers()
  const ct = res.headers.get("content-type")
  const cd = res.headers.get("content-disposition")
  if (ct) outHeaders.set("Content-Type", ct)
  if (cd) outHeaders.set("Content-Disposition", cd)
  return new NextResponse(outBody, { status: res.status, headers: outHeaders })
}
