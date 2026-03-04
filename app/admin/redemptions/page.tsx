"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  adminListRedemptions,
  adminUpdateRedemption,
  adminBulkUpdateRedemptions,
  type AdminRedemption,
} from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"

const STATUSES = [
  { value: "all", label: "Все статусы" },
  { value: "pending", label: "Ожидают" },
  { value: "fulfilled", label: "Выполнены" },
  { value: "cancelled", label: "Отменены" },
] as const

const PAGE_SIZES = [25, 50, 100, 200] as const

function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd.MM.yyyy HH:mm")
}

export default function AdminRedemptionsPage() {
  const [data, setData] = useState<{
    items: AdminRedemption[]
    total: number
    page: number
    pageSize: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [searchApplied, setSearchApplied] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [actionModal, setActionModal] = useState<{
    type: "single" | "bulk"
    id?: number
    ids?: number[]
    status: "fulfilled" | "cancelled"
    returnCoins?: boolean
  } | null>(null)
  const [notes, setNotes] = useState("")
  const [returnCoins, setReturnCoins] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setSearchApplied(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const params: Parameters<typeof adminListRedemptions>[0] = {
      page,
      pageSize,
    }
    if (statusFilter && statusFilter !== "all") params.status = statusFilter
    if (searchApplied.trim()) params.search = searchApplied.trim()
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    adminListRedemptions(params)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [page, pageSize, statusFilter, searchApplied, dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, searchApplied, dateFrom, dateTo, pageSize])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 0
  const pendingOnPage = data?.items.filter((r) => r.status === "pending") ?? []

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingOnPage.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingOnPage.map((r) => r.id)))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openSingleAction = (id: number, status: "fulfilled" | "cancelled", withReturnCoins?: boolean) => {
    setActionModal({ type: "single", id, status, returnCoins: status === "cancelled" ? withReturnCoins ?? true : false })
    setNotes("")
    setReturnCoins(status === "cancelled")
  }

  const openBulkAction = (status: "fulfilled" | "cancelled") => {
    if (selectedIds.size === 0) return
    setActionModal({
      type: "bulk",
      ids: Array.from(selectedIds),
      status,
      returnCoins: status === "cancelled",
    })
    setNotes("")
    setReturnCoins(status === "cancelled")
  }

  const confirmAction = () => {
    if (!actionModal) return
    if (actionModal.type === "single" && actionModal.id != null) {
      setUpdatingId(actionModal.id)
      adminUpdateRedemption(actionModal.id, actionModal.status, {
        notes: notes.trim() || undefined,
        returnCoins: actionModal.status === "cancelled" ? returnCoins : undefined,
      })
        .then(() => {
          setActionModal(null)
          load()
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setUpdatingId(null))
      return
    }
    if (actionModal.type === "bulk" && actionModal.ids?.length) {
      setBulkUpdating(true)
      adminBulkUpdateRedemptions(actionModal.ids, actionModal.status, {
        notes: notes.trim() || undefined,
        returnCoins: actionModal.status === "cancelled" ? returnCoins : undefined,
      })
        .then((res) => {
          setActionModal(null)
          setSelectedIds(new Set())
          if (res.errors.length > 0) {
            setError(`Обновлено: ${res.updated}. Ошибки: ${res.errors.map((e) => `#${e.id} (${e.reason})`).join(", ")}`)
          }
          load()
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
        .finally(() => setBulkUpdating(false))
    }
  }

  const start = data ? (data.page - 1) * data.pageSize + 1 : 0
  const end = data ? Math.min(data.page * data.pageSize, data.total) : 0

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Заявки на обмен</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status">Статус</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search">Поиск</Label>
              <Input
                id="search"
                placeholder="ID пользователя, имя, товар..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">Дата от</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">Дата до</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pageSize">На странице</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v))}
              >
                <SelectTrigger id="pageSize" className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingOnPage.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Выбрано: {selectedIds.size} из {pendingOnPage.length} ожидающих на странице
          </span>
          <Button
            size="sm"
            variant="default"
            disabled={selectedIds.size === 0 || bulkUpdating}
            onClick={() => openBulkAction("fulfilled")}
          >
            Отметить выбранные выполненными
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0 || bulkUpdating}
            onClick={() => openBulkAction("cancelled")}
          >
            Отменить выбранные (с возвратом монет)
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        {loading ? (
          <CardContent className="p-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        ) : data ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {pendingOnPage.length > 0 && (
                        <Checkbox
                          checked={selectedIds.size === pendingOnPage.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Выбрать все ожидающие"
                        />
                      )}
                    </TableHead>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead className="text-right">Монет</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right w-40">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.status === "pending" && (
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                            aria-label={`Выбрать заявку #${r.id}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/users/${r.userId}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {r.userName ?? `#${r.userId}`}
                        </Link>
                        <span className="text-muted-foreground text-xs ml-1">#{r.userId}</span>
                      </TableCell>
                      <TableCell>{r.itemName}</TableCell>
                      <TableCell className="text-right font-medium">{r.coinsSpent}</TableCell>
                      <TableCell>
                        <span
                          className={
                            r.status === "pending"
                              ? "text-amber-600 dark:text-amber-400"
                              : r.status === "fulfilled"
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                          }
                        >
                          {r.status === "pending"
                            ? "Ожидает"
                            : r.status === "fulfilled"
                              ? "Выполнено"
                              : "Отменено"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              disabled={updatingId === r.id}
                              onClick={() => openSingleAction(r.id, "fulfilled")}
                            >
                              Выполнено
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === r.id}
                              onClick={() => openSingleAction(r.id, "cancelled", true)}
                            >
                              Отмена
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.items.length === 0 && (
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">Нет заявок</p>
              </CardContent>
            )}
            {data.total > 0 && (
              <CardContent className="border-t flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Показаны {start}–{end} из {data.total}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1) setPage(page - 1)
                        }}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p: number
                      if (totalPages <= 5) p = i + 1
                      else if (page <= 3) p = i + 1
                      else if (page >= totalPages - 2) p = totalPages - 4 + i
                      else p = page - 2 + i
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setPage(p)
                            }}
                            isActive={page === p}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page < totalPages) setPage(page + 1)
                        }}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </CardContent>
            )}
          </>
        ) : null}
      </Card>

      <Dialog open={!!actionModal} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionModal?.status === "fulfilled"
                ? "Отметить выполненным"
                : "Отменить заявку"}
              {actionModal?.type === "bulk" && actionModal.ids && ` (${actionModal.ids.length})`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="notes">Заметка (необязательно)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Комментарий для истории"
              />
            </div>
            {actionModal?.status === "cancelled" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="returnCoins"
                  checked={returnCoins}
                  onCheckedChange={(c) => setReturnCoins(!!c)}
                />
                <Label htmlFor="returnCoins" className="font-normal">
                  Вернуть монеты пользователю
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>
              Отмена
            </Button>
            <Button onClick={confirmAction} disabled={bulkUpdating || updatingId != null}>
              {bulkUpdating || updatingId != null ? "Сохранение…" : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
