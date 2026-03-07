"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminMockTojStatus,
  adminMockTojGenerate,
  adminMockTojListJobs,
  adminMockTojUpdateJobStatus,
  adminTojSyncStatus,
  adminTojSyncRun,
  adminListUsers,
} from "@/lib/admin-api"
import type { AdminUser, MockTojJob } from "@/lib/admin-api"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RefreshCw, Play } from "lucide-react"

function formatDate(iso: string | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default function AdminMockTojPage() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userId, setUserId] = useState<string>("")
  const [count, setCount] = useState("10")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [jobs, setJobs] = useState<MockTojJob[]>([])
  const [jobsTotal, setJobsTotal] = useState(0)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<{
    configured: boolean
    syncEnabled: boolean
  } | null>(null)
  const [syncRunning, setSyncRunning] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    processed: number
    skipped: number
    skippedReasons?: { noUser?: number; jobBeforeUser?: number; alreadySynced?: number }
    errors: string[]
    watermark?: string
  } | null>(null)
  const { toast } = useToast()

  const loadJobs = useCallback(() => {
    if (configured === false) return
    setJobsLoading(true)
    adminMockTojListJobs({ limit: 100, skip: 0 })
      .then((r) => {
        setJobs(r.items)
        setJobsTotal(r.total)
      })
      .catch(() => {
        setJobs([])
        setJobsTotal(0)
      })
      .finally(() => setJobsLoading(false))
  }, [configured])

  useEffect(() => {
    adminMockTojStatus()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    adminTojSyncStatus()
      .then(setSyncStatus)
      .catch(() => setSyncStatus(null))
  }, [])

  useEffect(() => {
    setLoading(true)
    adminListUsers(undefined, 200)
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

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
        loadJobs()
      })
      .catch((e) =>
        toast({
          title: e instanceof Error ? e.message : "Ошибка",
          variant: "destructive",
        })
      )
      .finally(() => setSubmitting(false))
  }

  const handleUpdateJobStatus = (jobId: string, status: string, initiatorType?: string) => {
    setUpdatingJobId(jobId)
    adminMockTojUpdateJobStatus(jobId, { status, initiatorType })
      .then(() => {
        toast({ title: "Статус обновлён" })
        loadJobs()
      })
      .catch((e) =>
        toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" })
      )
      .finally(() => setUpdatingJobId(null))
  }

  const handleSyncRun = () => {
    setSyncRunning(true)
    setSyncResult(null)
    adminTojSyncRun()
      .then((r) => {
        setSyncResult(r)
        toast({
          title: `Обработано: ${r.processed}, пропущено: ${r.skipped}`,
          variant: r.errors.length ? "destructive" : "default",
        })
      })
      .catch((e) => {
        toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" })
      })
      .finally(() => setSyncRunning(false))
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
          Синхронизация смен из TOJ
        </CardHeader>
        <CardContent className="space-y-3">
          {syncStatus && (
            <p className="text-xs text-muted-foreground">
              TOJ настроен: {syncStatus.configured ? "да" : "нет"}. Синхронизация
              включена: {syncStatus.syncEnabled ? "да" : "нет"} (
              TOJ_SYNC_ENABLED=true).
            </p>
          )}
          {!loading && syncStatus?.configured && usersWithExternalId.length === 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                Нет пользователей с заполненным external_id. Синхронизация привязывает смены TOJ к пользователям по полю workerId = external_id. Добавьте external_id нужным пользователям (карточка пользователя или ETL) и сгенерируйте смены для них выше.
              </AlertDescription>
            </Alert>
          )}
          {!loading && syncStatus?.configured && usersWithExternalId.length > 0 && jobsTotal === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              В моке пока нет смен. Сначала нажмите «Сгенерировать смены» ниже (выберите пользователя с external_id).
            </p>
          )}
          <Button
            onClick={handleSyncRun}
            disabled={
              syncRunning ||
              !syncStatus?.configured ||
              !syncStatus?.syncEnabled ||
              (!loading && usersWithExternalId.length === 0)
            }
          >
            <Play size={14} className="mr-1" />
            {syncRunning ? "Синхронизация…" : "Синхронизировать смены"}
          </Button>
          {syncResult && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Обработано: {syncResult.processed}, пропущено: {syncResult.skipped}</p>
              {syncResult.skippedReasons &&
                (syncResult.skippedReasons.noUser > 0 ||
                  syncResult.skippedReasons.jobBeforeUser > 0 ||
                  syncResult.skippedReasons.alreadySynced > 0) && (
                  <p className="text-amber-600 dark:text-amber-500">
                    Причины пропуска:{" "}
                    {[
                      syncResult.skippedReasons.noUser
                        ? `нет пользователя с external_id = workerId смены (${syncResult.skippedReasons.noUser})`
                        : null,
                      syncResult.skippedReasons.jobBeforeUser
                        ? `дата смены раньше регистрации пользователя (${syncResult.skippedReasons.jobBeforeUser})`
                        : null,
                      syncResult.skippedReasons.alreadySynced
                        ? `уже учтена ранее (${syncResult.skippedReasons.alreadySynced})`
                        : null,
                    ]
                      .filter(Boolean)
                      .join("; ")}
                  </p>
                )}
              {syncResult.watermark && (
                <p>Watermark: {syncResult.watermark}</p>
              )}
              {syncResult.errors.length > 0 && (
                <p className="text-destructive">
                  Ошибки: {syncResult.errors.slice(0, 5).join("; ")}
                  {syncResult.errors.length > 5 && " …"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="py-2 flex flex-row items-center justify-between gap-2">
          <span className="text-sm font-medium">Сгенерированные смены</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadJobs}
            disabled={jobsLoading || configured === false}
          >
            <RefreshCw
              size={14}
              className={jobsLoading ? "animate-spin" : ""}
            />
            <span className="ml-1">Обновить</span>
          </Button>
        </CardHeader>
        <CardContent>
          {configured === false ? (
            <p className="text-sm text-muted-foreground">
              Мок не настроен — список недоступен.
            </p>
          ) : jobsLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : jobsTotal === 0 ? (
            <p className="text-sm text-muted-foreground">
              Смен нет. Сгенерируйте их выше.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Показано {jobs.length} из {jobsTotal}
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>workerId</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Инициатор</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Начало</TableHead>
                      <TableHead>Конец</TableHead>
                      <TableHead className="text-right">Часы</TableHead>
                      <TableHead className="text-right">Оплата/ч</TableHead>
                      <TableHead className="w-[140px]">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job._id}>
                        <TableCell className="font-mono text-xs truncate max-w-[80px]" title={job._id}>
                          {job._id?.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {job.workerId ?? "—"}
                        </TableCell>
                        <TableCell>{job.status ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {job.statusChangeMeta?.initiatorType
                            ? `${job.statusChangeMeta.initiatorType}${job.statusChangeMeta.at ? ` (${formatDate(job.statusChangeMeta.at)})` : ""}`
                            : "—"}
                        </TableCell>
                        <TableCell>{job.customName ?? job.spec ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDate(job.start)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatDate(job.finish)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {job.hours ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {job.paymentPerHour ?? job.salaryPerHour ?? "—"}
                        </TableCell>
                        <TableCell>
                          {job.status !== "cancelled" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              disabled={updatingJobId === job._id}
                              onClick={() =>
                                handleUpdateJobStatus(job._id, "cancelled", "worker")
                              }
                            >
                              {updatingJobId === job._id ? "…" : "Отменить (worker)"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
