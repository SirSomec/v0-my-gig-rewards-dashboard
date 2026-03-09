import { NextRequest, NextResponse } from "next/server"

const MYGIG_BASE = (process.env.NEXT_PUBLIC_MYGIG_API_URL ?? "").trim().replace(/\/$/, "")
const REWARDS_API_BASE = (process.env.NEXT_PUBLIC_REWARDS_API_URL ?? "http://localhost:3001").replace(/\/$/, "")
// Читаем в рантайме (не при сборке), чтобы в Docker контейнер мог передать переменную через env
function getInternalSecret(): string {
  return (process.env["REWARDS_INTERNAL_SECRET"] ?? "").trim()
}

/**
 * После входа через MyGig: по токену получаем профиль, находим или создаём пользователя
 * в нашей БД по external_id, возвращаем наш JWT для дашборда.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Неавторизованный запрос" }, { status: 401 })
  }
  if (!MYGIG_BASE) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_MYGIG_API_URL не задан" },
      { status: 500 }
    )
  }
  const INTERNAL_SECRET = getInternalSecret()
  if (!INTERNAL_SECRET) {
    return NextResponse.json(
      {
        error:
          "REWARDS_INTERNAL_SECRET не задан на сервере. Добавьте в корневой .env строку REWARDS_INTERNAL_SECRET=ваш-секрет (то же значение задайте для Nest API). После правки перезапустите приложение (или контейнер app: docker compose restart app).",
      },
      { status: 500 }
    )
  }
  try {
    const profileRes = await fetch(`${MYGIG_BASE}/user/profile`, {
      method: "GET",
      headers: { Authorization: auth },
    })
    if (!profileRes.ok) {
      const text = await profileRes.text()
      return NextResponse.json(
        { error: text || "Ошибка получения профиля MyGig" },
        { status: profileRes.status === 401 ? 401 : 502 }
      )
    }
    const profile = (await profileRes.json()) as {
      _id?: string
      user?: string
      firstname?: string | null
      lastname?: string | null
      full_name?: string | null
    }
    const externalId = (profile._id ?? profile.user ?? "").toString().trim()
    if (!externalId) {
      return NextResponse.json(
        { error: "В профиле MyGig нет идентификатора пользователя" },
        { status: 400 }
      )
    }
    const fn = (profile.firstname ?? "").toString().trim()
    const ln = (profile.lastname ?? "").toString().trim()
    const fullName = (profile.full_name ?? [ln, fn].filter(Boolean).join(" ")).toString().trim()

    const ensureRes = await fetch(`${REWARDS_API_BASE}/v1/auth/ensure-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ externalId, name: fullName || undefined }),
    })
    const ensureData = (await ensureRes.json()) as { accessToken?: string; message?: string }
    if (!ensureRes.ok) {
      return NextResponse.json(
        { error: ensureData.message ?? "Ошибка синхронизации пользователя" },
        { status: ensureRes.status }
      )
    }
    if (!ensureData.accessToken) {
      return NextResponse.json(
        { error: "Сервер не вернул токен" },
        { status: 502 }
      )
    }
    return NextResponse.json({ accessToken: ensureData.accessToken })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка синхронизации"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
