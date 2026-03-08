"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  adminListUsers,
  adminGetEtlUserByExternalId,
  adminCreateUser,
} from "@/lib/admin-api"
import type { AdminUser } from "@/lib/admin-api"
import { Input } from "@/components/ui/input"
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"

const PAGE_SIZE = 20

function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, "dd.MM.yyyy HH:mm")
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [data, setData] = useState<{
    items: AdminUser[]
    total: number
    page: number
    pageSize: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchApplied, setSearchApplied] = useState("")
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [externalId, setExternalId] = useState("")
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [loadEtlLoading, setLoadEtlLoading] = useState(false)
  const [loadEtlError, setLoadEtlError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchApplied(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const loadUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListUsers({
      search: searchApplied.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [searchApplied, page])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    setPage(1)
  }, [searchApplied])

  const handleOpenDialog = () => {
    setDialogOpen(true)
    setExternalId("")
    setFirstname("")
    setLastname("")
    setLoadEtlError(null)
    setCreateError(null)
  }

  const handleLoadFromEtl = () => {
    const id = externalId.trim()
    if (!id) return
    setLoadEtlLoading(true)
    setLoadEtlError(null)
    adminGetEtlUserByExternalId(id)
      .then((u) => {
        setFirstname(u.firstname ?? "")
        setLastname(u.lastname ?? "")
      })
      .catch((e) => setLoadEtlError(e instanceof Error ? e.message : "Ошибка загрузки из ETL"))
      .finally(() => setLoadEtlLoading(false))
  }

  const handleCreate = () => {
    const id = externalId.trim()
    if (!id) return
    setCreateLoading(true)
    setCreateError(null)
    adminCreateUser({
      externalId: id,
      firstname: firstname.trim() || undefined,
      lastname: lastname.trim() || undefined,
    })
      .then(({ id: newId }) => {
        setDialogOpen(false)
        loadUsers()
        router.push(`/users/${newId}`)
      })
      .catch((e) => setCreateError(e instanceof Error ? e.message : "Ошибка создания"))
      .finally(() => setCreateLoading(false))
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 0
  const start = data ? (data.page - 1) * data.pageSize + 1 : 0
  const end = data ? Math.min(data.page * data.pageSize, data.total) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Пользователи</h1>
        <Button onClick={handleOpenDialog}>Добавить пользователя</Button>
      </div>
      <Input
        placeholder="Поиск по ID, имени, email, external_id..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">ID</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Уровень</TableHead>
                  <TableHead className="text-right">Баланс</TableHead>
                  <TableHead className="text-right">Смены</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-muted-foreground">{u.id}</TableCell>
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{u.externalId ?? "—"}</TableCell>
                    <TableCell>{u.levelName ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{u.balance}</TableCell>
                    <TableCell className="text-right">{u.shiftsCompleted}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/users/${u.id}`}>Открыть</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.items.length === 0 && !error && (
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">Нет пользователей</p>
            </CardContent>
          )}
          {data && data.total > 0 && (
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
                      aria-label="Предыдущая страница"
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
                      aria-label="Следующая страница"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Введите ID пользователя основной системы. Имя и фамилия подгружаются из ETL (таблица etl.mg_users) и отображаются в личном кабинете.
          </p>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="externalId">ID пользователя основной системы</Label>
              <div className="flex gap-2">
                <Input
                  id="externalId"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="например, 12345"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLoadFromEtl}
                  disabled={loadEtlLoading || !externalId.trim()}
                >
                  {loadEtlLoading ? "Загрузка…" : "Загрузить из ETL"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">Имя</Label>
                <Input
                  id="firstname"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  placeholder="из ETL"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">Фамилия</Label>
                <Input
                  id="lastname"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  placeholder="из ETL"
                />
              </div>
            </div>
            {loadEtlError && (
              <p className="text-sm text-destructive">{loadEtlError}</p>
            )}
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLoading || !externalId.trim()}
            >
              {createLoading ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
