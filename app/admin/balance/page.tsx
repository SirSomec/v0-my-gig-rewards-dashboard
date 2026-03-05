"use client"

import { useState, useEffect } from "react"
import {
  adminListUsers,
  adminManualTransaction,
  type AdminUser,
} from "@/lib/admin-api"
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

export default function AdminBalancePage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userId, setUserId] = useState<string>("")
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<"manual_credit" | "manual_debit">("manual_credit")
  const [comment, setComment] = useState("")
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setLoadingUsers(true)
    adminListUsers(undefined, 200)
      .then(setUsers)
      .finally(() => setLoadingUsers(false))
  }, [])

  const handleSubmit = () => {
    const uid = Number(userId)
    const amt = Number(amount)
    if (Number.isNaN(uid) || !userId) {
      toast({ title: "Выберите пользователя", variant: "destructive" })
      return
    }
    if (Number.isNaN(amt) || amt <= 0) {
      toast({ title: "Введите положительную сумму", variant: "destructive" })
      return
    }
    const u = users.find((x) => x.id === uid)
    if (type === "manual_debit" && u && u.balance < amt) {
      toast({ title: "Недостаточно монет на балансе пользователя", variant: "destructive" })
      return
    }
    setSubmitting(true)
    adminManualTransaction({
      userId: uid,
      amount: amt,
      type,
      description: comment.trim() || undefined,
    })
      .then(() => {
        toast({ title: type === "manual_credit" ? "Монеты начислены" : "Монеты списаны" })
        setAmount("")
        setComment("")
      })
      .catch((e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Ручные начисления и списания (6.6)</h1>

      <Card>
        <CardHeader className="py-2 text-sm font-medium">
          Форма: пользователь, сумма, тип, комментарий
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Пользователь</Label>
            {loadingUsers ? (
              <p className="text-sm text-muted-foreground">Загрузка...</p>
            ) : (
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      #{u.id} {u.name ?? u.email ?? "—"} — баланс: {u.balance} монет
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Тип операции</Label>
            <Select value={type} onValueChange={(v) => setType(v as "manual_credit" | "manual_debit")}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_credit">Начисление</SelectItem>
                <SelectItem value="manual_debit">Списание</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Сумма (монет)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comment">Комментарий (опционально)</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Бонус, компенсация, корректировка…"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !userId || !amount.trim()}
          >
            {submitting ? "Сохранение…" : type === "manual_credit" ? "Начислить" : "Списать"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
