"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  adminGetUser,
  adminListLevels,
  adminUpdateUserLevel,
  adminRemoveStrike,
  type AdminLevel,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { ArrowLeft } from "lucide-react"

function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd.MM.yyyy HH:mm")
}

type UserDetail = {
  id: number
  name: string | null
  email: string | null
  externalId: string | null
  balance: number
  shiftsCompleted: number
  levelId: number
  levelName: string
  /** Рейтинг надёжности 0–5 (дробное). По умолчанию 4. */
  reliabilityRating?: number
  strikesCount30d: number
  strikes: Array<{
    id: number
    userId: number
    type: string
    shiftExternalId?: string | null
    occurredAt: string | Date
    removedAt?: string | Date | null
  }>
  recentTransactions: Array<{
    id: number
    userId: number
    amount: number
    type: string
    title?: string | null
    description?: string | null
    createdAt: string | Date
  }>
  createdAt?: string
  updatedAt?: string
}

function isUserDetail(v: Record<string, unknown>): v is UserDetail {
  return typeof v.id === "number" && typeof v.balance === "number"
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const idParam = params?.id
  const id = typeof idParam === "string" ? parseInt(idParam, 10) : NaN

  const [user, setUser] = useState<UserDetail | null>(null)
  const [levels, setLevels] = useState<AdminLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [levelSaving, setLevelSaving] = useState(false)
  const [levelError, setLevelError] = useState<string | null>(null)
  const [removeStrikeDialog, setRemoveStrikeDialog] = useState<{
    strikeId: number
    type: string
    occurredAt: string
  } | null>(null)
  const [removeStrikeReason, setRemoveStrikeReason] = useState("")
  const [removeStrikeLoading, setRemoveStrikeLoading] = useState(false)
  const [removeStrikeError, setRemoveStrikeError] = useState<string | null>(null)

  const loadUser = useCallback(() => {
    if (Number.isNaN(id) || id < 1) {
      setError("Неверный ID пользователя")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    adminGetUser(id)
      .then((raw) => {
        if (isUserDetail(raw)) {
          setUser(raw)
        } else {
          setError("Неверный формат ответа")
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useEffect(() => {
    adminListLevels()
      .then(setLevels)
      .catch(() => setLevels([]))
  }, [])

  const handleLevelChange = (levelIdStr: string) => {
    const levelId = parseInt(levelIdStr, 10)
    if (Number.isNaN(levelId) || !user) return
    setLevelError(null)
    setLevelSaving(true)
    adminUpdateUserLevel(user.id, levelId)
      .then(() => {
        setUser((u) => (u ? { ...u, levelId, levelName: levels.find((l) => l.id === levelId)?.name ?? u.levelName } : null))
      })
      .catch((e) => setLevelError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLevelSaving(false))
  }

  const openRemoveStrike = (s: { id: number; type: string; occurredAt: string | Date }) => {
    setRemoveStrikeDialog({
      strikeId: s.id,
      type: s.type,
      occurredAt: formatDate(s.occurredAt),
    })
    setRemoveStrikeReason("")
    setRemoveStrikeError(null)
  }

  const handleRemoveStrike = () => {
    if (!removeStrikeDialog || !user) return
    const reason = removeStrikeReason.trim()
    if (!reason) {
      setRemoveStrikeError("Укажите причину снятия штрафа")
      return
    }
    setRemoveStrikeLoading(true)
    setRemoveStrikeError(null)
    adminRemoveStrike(removeStrikeDialog.strikeId, reason)
      .then(() => {
        setRemoveStrikeDialog(null)
        loadUser()
      })
      .catch((e) => setRemoveStrikeError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setRemoveStrikeLoading(false))
  }

  if (Number.isNaN(id) || id < 1) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-1 h-4 w-4" />
            К списку пользователей
          </Link>
        </Button>
        <p className="text-sm text-destructive">Неверный ID пользователя</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-1 h-4 w-4" />
            К списку пользователей
          </Link>
        </Button>
        <p className="text-sm text-destructive">{error ?? "Пользователь не найден"}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-1 h-4 w-4" />
            К списку пользователей
          </Link>
        </Button>
      </div>

      <h1 className="text-lg font-semibold">
        {user.name || user.email || `Пользователь #${user.id}`}
      </h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">ID</dt>
                <dd className="font-mono">{user.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Имя</dt>
                <dd>{user.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{user.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">External ID</dt>
                <dd className="font-mono">{user.externalId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Баланс</dt>
                <dd className="font-medium">{user.balance}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Смен выполнено</dt>
                <dd>{user.shiftsCompleted}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Рейтинг надёжности</dt>
                <dd className="font-medium">{(user.reliabilityRating ?? 4).toFixed(1)} / 5</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Создан</dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-4">
            <div>
              <Label className="text-muted-foreground">Уровень</Label>
              <div className="mt-1 flex items-center gap-2">
                <Select
                  value={String(user.levelId)}
                  onValueChange={handleLevelChange}
                  disabled={levelSaving}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {levelSaving && (
                  <span className="text-xs text-muted-foreground">Сохранение…</span>
                )}
              </div>
              {levelError && (
                <p className="mt-1 text-xs text-destructive">{levelError}</p>
              )}
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Штрафов за 30 дней</dt>
              <dd className="font-medium">{user.strikesCount30d}</dd>
            </div>
          </CardContent>
        </Card>
      </div>

      {user.strikes && user.strikes.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-medium mb-3">Штрафы (последние 20)</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Смена (external)</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Снят</TableHead>
                    <TableHead className="w-24">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.strikes.map((s) => {
                    const isRemoved = !!s.removedAt
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-muted-foreground">{s.id}</TableCell>
                        <TableCell>{s.type}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {s.shiftExternalId ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(s.occurredAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isRemoved ? formatDate(s.removedAt) : "—"}
                        </TableCell>
                        <TableCell>
                          {!isRemoved && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRemoveStrike(s)}
                            >
                              Снять
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {user.recentTransactions && user.recentTransactions.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-medium mb-3">Последние транзакции (20)</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-muted-foreground">{tx.id}</TableCell>
                      <TableCell className={tx.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount}
                      </TableCell>
                      <TableCell>{tx.type}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {tx.title || tx.description || "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!removeStrikeDialog}
        onOpenChange={(open) => !open && setRemoveStrikeDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Снять штраф</DialogTitle>
          </DialogHeader>
          {removeStrikeDialog && (
            <>
              <p className="text-sm text-muted-foreground">
                Штраф #{removeStrikeDialog.strikeId} ({removeStrikeDialog.type}, {removeStrikeDialog.occurredAt}). Укажите причину снятия (для аудита).
              </p>
              <div className="grid gap-2">
                <Label htmlFor="remove-strike-reason">Причина</Label>
                <Input
                  id="remove-strike-reason"
                  value={removeStrikeReason}
                  onChange={(e) => setRemoveStrikeReason(e.target.value)}
                  placeholder="Например: ошибочно занесён"
                />
              </div>
              {removeStrikeError && (
                <p className="text-sm text-destructive">{removeStrikeError}</p>
              )}
            </>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveStrikeDialog(null)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleRemoveStrike}
              disabled={removeStrikeLoading || !removeStrikeReason.trim()}
            >
              {removeStrikeLoading ? "Сохранение…" : "Снять штраф"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
