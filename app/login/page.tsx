"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { authPhone, authCode, type AuthPhoneResponse } from "@/lib/mygig-auth"

const DEV_MODE_AUTO_SUBMIT_DELAY_MS = 800

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"phone" | "code">("phone")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [betweenLimiterTime, setBetweenLimiterTime] = useState<number | null>(null)

  const handleRequestCode = useCallback(async () => {
    const raw = phone.replace(/\D/g, "")
    if (raw.length < 10) {
      setError("Введите номер телефона")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const data = await authPhone(phone)
      setBetweenLimiterTime((data as AuthPhoneResponse).betweenLimiterTime ?? null)
      const devMode = (data as AuthPhoneResponse).DEV_MODE
      if (devMode != null) {
        const codeStr = String(devMode)
        setCode(codeStr)
        setStep("code")
        // Автоматически подставляем код и через короткую задержку отправляем запрос входа
        setTimeout(() => {
          setError(null)
          handleLogin(codeStr)
        }, DEV_MODE_AUTO_SUBMIT_DELAY_MS)
      } else {
        setStep("code")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса кода")
    } finally {
      setLoading(false)
    }
  }, [phone])

  const handleLogin = useCallback(
    async (codeValue?: string) => {
      const c = codeValue ?? code
      if (!c.trim()) {
        setError("Введите код из СМС")
        return
      }
      setError(null)
      setLoading(true)
      try {
        await authCode(phone, c)
        router.replace("/")
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка входа")
      } finally {
        setLoading(false)
      }
    },
    [phone, code, router]
  )

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 max-w-md mx-auto">
      <div className="w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">Вход в дашборд наград</h1>
          <p className="text-sm text-muted-foreground">
            Введите номер телефона и код из СМС
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === "phone") handleRequestCode()
            else handleLogin()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Номер телефона</FieldLabel>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="+7 916 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading || step === "code"}
                autoFocus
              />
            </Field>

            {step === "code" && (
              <Field>
                <FieldLabel>Код из СМС</FieldLabel>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="1234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                  maxLength={6}
                  autoFocus={step === "code"}
                />
              </Field>
            )}
          </FieldGroup>

          {error && (
            <FieldError>{error}</FieldError>
          )}

          {betweenLimiterTime != null && betweenLimiterTime > 0 && (
            <p className="text-xs text-muted-foreground">
              Следующий запрос кода можно отправить через {betweenLimiterTime} сек.
            </p>
          )}

          <div className="flex gap-2">
            {step === "code" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("phone")
                  setCode("")
                  setError(null)
                }}
                disabled={loading}
              >
                Назад
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Проверка…" : step === "phone" ? "Получить код" : "Войти"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
