"use client"

import { useState, useEffect } from "react"
import {
  adminMockTojStatus,
  adminMockTojGenerate,
  adminListUsers,
} from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminMockTojPage() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userId, setUserId] = useState<string>("")
  const [count, setCount] = useState("10")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    adminMockTojStatus()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    adminListUsers(undefined, 200)
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  const usersWithExternalId = users.filter((u) => u.externalId?.trim())
  const selectedUser = users.find((u) => String(u.id) === userId)

  const handleGenerate = () => {
    const uid = Number(userId)
    if (Number.isNaN(uid)) {
      toast({ title: "Выберите пользователя", variant: "destructive" })
      return
    }
    if (!selectedUser?.externalId?.trim()) {
      toast({
        title: "У пользователя должен быть указан external_id (для привязки смен в TOJ)",
        variant: "destructive",
      })
      return
    }
    const numCount = Math.min(Math.max(Number(count) || 10, 1), 500)
    setSubmitting(true)
    adminMockTojGenerate({
      userId: uid,
      count: numCount,
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
    })
      .then((r) => {
        toast({ title: `Сгенерировано смен: ${r.generated}` })
      })
      .catch((e) =>
        toast({
          title: e instanceof Error ? e.message : "Ошибка",
          variant: "destructive",
        })
      )
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Мок TOJ (смены)</h1>

      {configured === false && (
        <Alert variant="destructive">
          <AlertDescription>
            Мок TOJ не настроен. Задайте в env бэкенда: MOCK_TOJ_URL (например
            http://mock-toj:3010) и MOCK_TOJ_ADMIN_KEY. Запустите контейнер
            mock-toj (docker-compose up mock-toj).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="py-2 text-sm font-medium">
          Пользователь для мок-смен (workerId = external_id)
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {usersWithExternalId.length > 0 ? (
                    usersWithExternalId.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        #{u.id} {u.name ?? u.email ?? ""} — external_id:{" "}
                        {u.externalId}
                      </SelectItem>
                    ))
                  ) : (
                    users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        #{u.id} {u.name ?? u.email ?? ""}
                        {!u.externalId && " (нет external_id)"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {usersWithExternalId.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  В списке сначала пользователи с указанным external_id — их
                  смены будут привязаны к ним в TOJ.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">
          Параметры генерации
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Количество смен (1–500)</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Дата от (опционально)</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Дата до (опционально)</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={
              submitting ||
              !userId ||
              !selectedUser?.externalId?.trim() ||
              configured === false
            }
          >
            {submitting ? "Генерация..." : "Сгенерировать смены"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
