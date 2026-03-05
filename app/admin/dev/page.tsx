"use client"

import { useState, useEffect } from "react"
import { adminRecordShift, adminRegisterStrike, adminListUsers } from "@/lib/admin-api"
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

export default function AdminDevPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userId, setUserId] = useState<string>("")
  const [coins, setCoins] = useState("")
  const [shiftTitle, setShiftTitle] = useState("")
  const [shiftClientId, setShiftClientId] = useState("")
  const [shiftCategory, setShiftCategory] = useState("")
  const [shiftHours, setShiftHours] = useState("")
  const [strikeType, setStrikeType] = useState<"no_show" | "late_cancel">("no_show")
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [submittingShift, setSubmittingShift] = useState(false)
  const [submittingStrike, setSubmittingStrike] = useState(false)
  const { toast } = useToast()

  const loadUsers = () => {
    setLoadingUsers(true)
    adminListUsers(undefined, 100)
      .then(setUsers)
      .finally(() => setLoadingUsers(false))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleRecordShift = () => {
    const uid = Number(userId)
    const c = Number(coins)
    if (Number.isNaN(uid) || Number.isNaN(c) || c < 0) {
      toast({ title: "Укажите userId и кол-во монет", variant: "destructive" })
      return
    }
    setSubmittingShift(true)
    adminRecordShift({
      userId: uid,
      coins: c,
      title: shiftTitle || undefined,
      clientId: shiftClientId.trim() || undefined,
      category: shiftCategory.trim() || undefined,
      hours: shiftHours ? Number(shiftHours) : undefined,
    })
      .then(() => {
        toast({ title: "Смена засчитана" })
        setCoins("")
        setShiftTitle("")
        setShiftClientId("")
        setShiftCategory("")
        setShiftHours("")
        loadUsers()
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSubmittingShift(false))
  }

  const handleRegisterStrike = () => {
    const uid = Number(userId)
    if (Number.isNaN(uid)) {
      toast({ title: "Укажите userId", variant: "destructive" })
      return
    }
    setSubmittingStrike(true)
    adminRegisterStrike({ userId: uid, type: strikeType })
      .then((res) => {
        toast({ title: res.levelDemoted ? "Штраф добавлен, уровень понижен" : "Штраф добавлен" })
        loadUsers()
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSubmittingStrike(false))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Мок: смены и штрафы</h1>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">Выберите пользователя</CardHeader>
        <CardContent>
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Пользователь" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    #{u.id} {u.name ?? u.email ?? ""} ({u.balance} монет)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">Записать смену</CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Монеты за смену</Label>
            <Input
              type="number"
              min={0}
              value={coins}
              onChange={(e) => setCoins(e.target.value)}
              placeholder="50"
            />
          </div>
          <div>
            <Label>Название (опционально)</Label>
            <Input
              value={shiftTitle}
              onChange={(e) => setShiftTitle(e.target.value)}
              placeholder="Смена в ресторане"
            />
          </div>
          <div>
            <Label>Клиент / бренд (опционально)</Label>
            <Input
              value={shiftClientId}
              onChange={(e) => setShiftClientId(e.target.value)}
              placeholder="Код клиента для квестов"
            />
          </div>
          <div>
            <Label>Категория / профессия (опционально)</Label>
            <Input
              value={shiftCategory}
              onChange={(e) => setShiftCategory(e.target.value)}
              placeholder="Например: курьер"
            />
          </div>
          <div>
            <Label>Часы (опционально)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={shiftHours}
              onChange={(e) => setShiftHours(e.target.value)}
              placeholder="8"
            />
          </div>
          <Button
            onClick={handleRecordShift}
            disabled={submittingShift || !userId}
          >
            {submittingShift ? "Сохранение..." : "Записать смену"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">Добавить штраф</CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Тип</Label>
            <Select value={strikeType} onValueChange={(v) => setStrikeType(v as "no_show" | "late_cancel")}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_show">No-show</SelectItem>
                <SelectItem value="late_cancel">Поздняя отмена</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            onClick={handleRegisterStrike}
            disabled={submittingStrike || !userId}
          >
            {submittingStrike ? "Сохранение..." : "Добавить штраф"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
