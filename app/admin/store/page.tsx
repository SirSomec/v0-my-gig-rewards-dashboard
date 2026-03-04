"use client"

import { useState, useEffect } from "react"
import { adminListStoreItems } from "@/lib/admin-api"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminStorePage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminListStoreItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Магазин (товары)</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={Number(item.id)}>
              <CardContent className="p-3">
                <p className="font-medium">{String(item.name ?? item.id)}</p>
                <p className="text-xs text-muted-foreground">
                  Цена: {Number(item.cost ?? item.id)} монет · ID: {Number(item.id)}
                </p>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">Нет товаров</p>
          )}
        </div>
      )}
    </div>
  )
}
