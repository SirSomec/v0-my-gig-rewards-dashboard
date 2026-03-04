"use client"

import { useState, useEffect } from "react"
import { adminListLevels } from "@/lib/admin-api"
import type { AdminLevel } from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminLevelsPage() {
  const [levels, setLevels] = useState<AdminLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminListLevels()
      .then(setLevels)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Уровни</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {levels.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Смен до уровня: {l.shiftsRequired} · Порог штрафов: {l.strikeThreshold ?? "—"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">#{l.sortOrder}</span>
              </CardContent>
            </Card>
          ))}
          {levels.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет уровней</p>
          )}
        </div>
      )}
    </div>
  )
}
