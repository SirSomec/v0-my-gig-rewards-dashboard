"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminEtlExplorerStatus,
  adminEtlExplorerConnectionInfo,
  adminEtlExplorerDatabases,
  adminEtlExplorerSchemas,
  adminEtlExplorerTables,
  adminEtlExplorerColumns,
  adminEtlExplorerPreview,
  adminEtlExplorerQuery,
} from "@/lib/admin-api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Database, Table as TableIcon, AlertCircle } from "lucide-react"

function QueryResultTable({
  result,
}: {
  result: { rows: Record<string, unknown>[]; limited: boolean }
}) {
  const keys = result.rows.length > 0 ? Object.keys(result.rows[0]) : []
  return (
    <div className="border rounded-md">
      {result.limited && (
        <p className="text-xs text-muted-foreground px-3 py-1 bg-muted">
          Результат ограничен 200 строками.
        </p>
      )}
      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              {keys.map((k) => (
                <TableHead key={k} className="font-mono text-xs whitespace-nowrap">
                  {k}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, i) => (
              <TableRow key={i}>
                {keys.map((k) => (
                  <TableCell key={k} className="text-xs max-w-[200px] truncate">
                    {row[k] == null ? "NULL" : String(row[k])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}

export default function AdminEtlExplorerPage() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [envStatus, setEnvStatus] = useState<Record<string, boolean> | null>(null)
  const [processEnvEtlKeys, setProcessEnvEtlKeys] = useState<string[] | null>(null)
  const [connectionInfo, setConnectionInfo] = useState<{ database: string; user: string } | null>(null)
  const [databases, setDatabases] = useState<{ datname: string }[]>([])
  const [schemas, setSchemas] = useState<{ schema_name: string }[]>([])
  const [tables, setTables] = useState<{ table_name: string }[]>([])
  const [columns, setColumns] = useState<{ column_name: string; data_type: string; is_nullable: string }[]>([])
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [queryResult, setQueryResult] = useState<{ rows: Record<string, unknown>[]; limited: boolean } | null>(null)

  const [selectedSchema, setSelectedSchema] = useState<string>("")
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [customSql, setCustomSql] = useState("")
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingColumns, setLoadingColumns] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingQuery, setLoadingQuery] = useState(false)

  const loadStatus = useCallback(() => {
    setLoadingStatus(true)
    adminEtlExplorerStatus()
      .then((r) => {
        setConfigured(r.configured)
        setEnvStatus(r.env ?? null)
        setProcessEnvEtlKeys(r.processEnvEtlKeys ?? null)
        if (r.configured) {
          loadSchemas()
          adminEtlExplorerConnectionInfo().then(setConnectionInfo).catch(() => setConnectionInfo(null))
          setLoadingDatabases(true)
          adminEtlExplorerDatabases()
            .then(setDatabases)
            .catch(() => setDatabases([]))
            .finally(() => setLoadingDatabases(false))
        }
      })
      .catch(() => {
        setConfigured(false)
        setEnvStatus(null)
      })
      .finally(() => setLoadingStatus(false))
  }, [])

  const loadSchemas = useCallback(() => {
    setLoadingSchemas(true)
    adminEtlExplorerSchemas()
      .then(setSchemas)
      .catch(() => setSchemas([]))
      .finally(() => setLoadingSchemas(false))
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!configured || !selectedSchema) {
      setTables([])
      setSelectedTable("")
      return
    }
    setLoadingTables(true)
    adminEtlExplorerTables(selectedSchema)
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false))
  }, [configured, selectedSchema])

  useEffect(() => {
    setSelectedTable("")
    setColumns([])
    setPreview([])
  }, [selectedSchema])

  useEffect(() => {
    if (!configured || !selectedSchema || !selectedTable) {
      setColumns([])
      setPreview([])
      return
    }
    setLoadingColumns(true)
    setLoadingPreview(true)
    Promise.all([
      adminEtlExplorerColumns(selectedSchema, selectedTable),
      adminEtlExplorerPreview(selectedSchema, selectedTable, 50),
    ])
      .then(([cols, rows]) => {
        setColumns(cols)
        setPreview(rows)
      })
      .catch(() => {
        setColumns([])
        setPreview([])
      })
      .finally(() => {
        setLoadingColumns(false)
        setLoadingPreview(false)
      })
  }, [configured, selectedSchema, selectedTable])

  const runCustomQuery = () => {
    if (!customSql.trim()) return
    setLoadingQuery(true)
    setQueryResult(null)
    adminEtlExplorerQuery(customSql.trim())
      .then(setQueryResult)
      .catch(() => setQueryResult({ rows: [], limited: false }))
      .finally(() => setLoadingQuery(false))
  }

  if (loadingStatus) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Данные ETL</h1>
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Данные ETL</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Подключение к ETL не настроено. Задайте в .env бэкенда: ETL_HOST, ETL_PORT, ETL_USER, ETL_PASSWORD
            (и при необходимости ETL_DATABASE, ETL_SSL_ROOT_CERT). Перезапустите бэкенд и обновите страницу.
          </AlertDescription>
        </Alert>
        {envStatus && (
          <Card>
            <CardHeader className="py-2 text-sm font-medium">Что видит бэкенд (переменные заданы?)</CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-4 text-sm">
                {(["ETL_HOST", "ETL_PORT", "ETL_USER", "ETL_PASSWORD", "ETL_DATABASE", "ETL_SSL_ROOT_CERT"] as const).map(
                  (key) => (
                    <span
                      key={key}
                      className={envStatus[key] ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}
                    >
                      {key}: {envStatus[key] ? "да" : "нет"}
                    </span>
                  )
                )}
              </div>
              {processEnvEtlKeys && (
                <p className="text-xs text-muted-foreground">
                  В process.env контейнера найдены ключи ETL_*: {processEnvEtlKeys.length ? processEnvEtlKeys.join(", ") : "ни одного"}.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Если всё «нет» или ключи не найдены: .env должен быть в корне проекта (рядом с docker-compose.yml).
                Переменные подхватываются только при создании контейнера — после правки .env выполните:{" "}
                <code className="bg-muted px-1 rounded">docker compose up -d --force-recreate api</code>.
                Имена переменных строго: ETL_HOST, ETL_USER, ETL_PASSWORD (регистр важен).
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const previewKeys = preview.length > 0 ? Object.keys(preview[0]) : []

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Данные ETL</h1>
      <p className="text-sm text-muted-foreground">
        Обзор схем, таблиц и превью данных. Только чтение.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="py-3">
            <span className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Схемы и таблицы
            </span>
            {connectionInfo && (
              <p className="text-xs text-muted-foreground font-normal mt-1">
                Подключение: база <code className="bg-muted px-1 rounded">{connectionInfo.database}</code>, пользователь {connectionInfo.user}
              </p>
            )}
            {connectionInfo && (databases.length > 0 || loadingDatabases) && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground font-normal mb-1">Базы в кластере:</p>
                {loadingDatabases ? (
                  <Skeleton className="h-6 w-full" />
                ) : (
                  <p className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all">
                    {databases.map((d) => d.datname).join(", ")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Чтобы подключиться к другой базе, задайте в .env <code>ETL_DATABASE=имя_базы</code> и перезапустите api.
                </p>
              </div>
            )}
            {connectionInfo && schemas.length === 0 && !loadingSchemas && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-normal mt-1">
                Схем не найдено. Задайте в .env переменную ETL_DATABASE с именем базы, где лежат данные (если подключаетесь не к той базе).
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Схема</label>
              <Select value={selectedSchema} onValueChange={setSelectedSchema} disabled={loadingSchemas}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите схему" />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s.schema_name} value={s.schema_name}>
                      {s.schema_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Таблица</label>
              <Select
                value={selectedTable}
                onValueChange={setSelectedTable}
                disabled={loadingTables || !selectedSchema}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите таблицу" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.table_name} value={t.table_name}>
                      {t.table_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <Tabs defaultValue="table">
            <CardHeader className="py-3 pb-0">
              <TabsList>
                <TabsTrigger value="table">
                  <TableIcon className="h-4 w-4 mr-1.5" />
                  Таблица
                </TabsTrigger>
                <TabsTrigger value="sql">SQL</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-4">
              <TabsContent value="table" className="mt-0">
                {!selectedTable ? (
                  <p className="text-sm text-muted-foreground">Выберите схему и таблицу слева.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium mb-2">Колонки</h3>
                      {loadingColumns ? (
                        <Skeleton className="h-24 w-full" />
                      ) : columns.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Нет колонок</p>
                      ) : (
                        <ScrollArea className="w-full">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Колонка</TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead>NULL</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {columns.map((c) => (
                                <TableRow key={c.column_name}>
                                  <TableCell className="font-mono text-xs">{c.column_name}</TableCell>
                                  <TableCell className="text-muted-foreground text-xs">{c.data_type}</TableCell>
                                  <TableCell className="text-xs">{c.is_nullable}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium mb-2">Превью (до 50 строк)</h3>
                      {loadingPreview ? (
                        <Skeleton className="h-40 w-full" />
                      ) : preview.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Нет данных</p>
                      ) : (
                        <ScrollArea className="w-full border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {previewKeys.map((k) => (
                                  <TableHead key={k} className="font-mono text-xs whitespace-nowrap">
                                    {k}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preview.map((row, i) => (
                                <TableRow key={i}>
                                  {previewKeys.map((k) => (
                                    <TableCell key={k} className="text-xs max-w-[200px] truncate">
                                      {row[k] == null ? "NULL" : String(row[k])}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="sql" className="mt-0">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Только SELECT. Лимит 200 строк, если LIMIT не указан.
                  </p>
                  <Textarea
                    placeholder="SELECT * FROM schema.table LIMIT 10"
                    value={customSql}
                    onChange={(e) => setCustomSql(e.target.value)}
                    className="min-h-[120px] font-mono text-sm"
                  />
                  <Button onClick={runCustomQuery} disabled={loadingQuery || !customSql.trim()}>
                    {loadingQuery ? "Выполняю…" : "Выполнить"}
                  </Button>
                  {queryResult ? (
                    <QueryResultTable result={queryResult} />
                  ) : null}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
