"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  adminGetUser,
  adminListLevels,
  adminUpdateUserLevel,
  adminManualTransaction,
} from "@/lib/admin-api"
import type { AdminLevel } from "@/lib/admin-api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

export default function AdminUserDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [levels, setLevels] = useState<AdminLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [levelsLoading, setLevelsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [levelSelect, setLevelSelect] = useState<string>("")
  const [savingLevel, setSavingLevel] = useState(false)
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false)
  const [balanceType, setBalanceType] = useState<"manual_credit" | "manual_debit">("manual_credit")
  const [balanceAmount, setBalanceAmount] = useState("")
  const [balanceComment, setBalanceComment] = useState("")
  const [balanceSubmitting, setBalanceSubmitting] = useState(false)
  const { toast } = useToast()

  const loadUser = useCallback(() => {
    if (Number.isNaN(id)) return
    setLoading(true)
    setError(null)
    adminGetUser(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (Number.isNaN(id)) return
    loadUser()
  }, [id, loadUser])

  useEffect(() => {
    if (data && typeof (data as { levelId?: number }).levelId === "number") {
      setLevelSelect(String((data as { levelId: number }).levelId))
    }
  }, [data])

  useEffect(() => {
    setLevelsLoading(true)
    adminListLevels()
      .then(setLevels)
      .finally(() => setLevelsLoading(false))
  }, [])

  const handleSaveLevel = () => {
    const levelId = Number(levelSelect)
    if (Number.isNaN(levelId)) {
      toast({ title: "Выберите уровень", variant: "destructive" })
      return
    }
    setSavingLevel(true)
    adminUpdateUserLevel(id, levelId)
      .then(() => {
        toast({ title: "Уровень обновлён" })
        loadUser()
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSavingLevel(false))
  }

  const openBalanceDialog = (type: "manual_credit" | "manual_debit") => {
    setBalanceType(type)
    setBalanceAmount("")
    setBalanceComment("")
    setBalanceDialogOpen(true)
  }

  const handleBalanceSubmit = () => {
    const amount = Number(balanceAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Введите положительную сумму", variant: "destructive" })
      return
    }
    if (balanceType === "manual_debit" && data && Number((data as { balance?: number }).balance) < amount) {
      toast({ title: "Недостаточно монет на балансе", variant: "destructive" })
      return
    }
    setBalanceSubmitting(true)
    adminManualTransaction({
      userId: id,
      amount,
      type: balanceType,
      description: balanceComment.trim() || undefined,
    })
      .then((res) => {
        toast({ title: balanceType === "manual_credit" ? "Монеты начислены" : "Монеты списаны" })
        setBalanceDialogOpen(false)
        loadUser()
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setBalanceSubmitting(false))
  }

  if (Number.isNaN(id)) return <p className="text-destructive">Неверный ID</p>
  if (error) return <p className="text-destructive">{error}</p>
  if (loading || !data) return <Skeleton className="h-64 w-full rounded-lg" />

  const user = data as Record<string, unknown>
  const strikes = (user.strikes as Record<string, unknown>[]) ?? []
  const recentTransactions = (user.recentTransactions as Record<string, unknown>[]) ?? []
  const currentLevelId = Number(user.levelId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Пользователи
        </Link>
      </div>
      <h1 className="text-lg font-semibold">Пользователь #{user.id}</h1>
      <Card>
        <CardHeader className="pb-2">
          <p className="font-medium">{String(user.name ?? user.email ?? "—")}</p>
          <p className="text-xs text-muted-foreground">Email: {String(user.email ?? "—")}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Баланс: <strong>{Number(user.balance)}</strong> монет</p>
          <p>Уровень: {String(user.levelName ?? "—")}</p>
          <p>Завершено смен: {Number(user.shiftsCompleted)}</p>
          <p>Штрафов за 30 дней: {Number(user.strikesCount30d ?? 0)}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => openBalanceDialog("manual_credit")}>
              Начислить монеты
            </Button>
            <Button size="sm" variant="outline" onClick={() => openBalanceDialog("manual_debit")}>
              Списать монеты
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">Изменить уровень (6.5)</CardHeader>
        <CardContent className="space-y-2">
          {levelsLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка уровней...</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={levelSelect} onValueChange={setLevelSelect}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Выберите уровень" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleSaveLevel}
                  disabled={savingLevel || Number(levelSelect) === currentLevelId}
                >
                  {savingLevel ? "Сохранение…" : "Сохранить уровень"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {strikes.length > 0 && (
        <Card>
          <CardHeader className="py-2 text-sm font-medium">Штрафы</CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {strikes.map((s: Record<string, unknown>, i: number) => (
                <li key={i}>
                  {String(s.type)} — {String(s.occurredAt)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="py-2 text-sm font-medium">Последние транзакции</CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1">
            {recentTransactions.slice(0, 10).map((t: Record<string, unknown>, i: number) => (
              <li key={i}>
                {String(t.type)} {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount)} — {String(t.title ?? "")}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {balanceType === "manual_credit" ? "Начислить монеты" : "Списать монеты"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="balance-amount">Сумма</Label>
              <Input
                id="balance-amount"
                type="number"
                min={1}
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="balance-comment">Комментарий (опционально)</Label>
              <Input
                id="balance-comment"
                value={balanceComment}
                onChange={(e) => setBalanceComment(e.target.value)}
                placeholder="Причина начисления/списания"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleBalanceSubmit}
              disabled={balanceSubmitting || !balanceAmount.trim()}
            >
              {balanceSubmitting ? "Сохранение…" : balanceType === "manual_credit" ? "Начислить" : "Списать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
