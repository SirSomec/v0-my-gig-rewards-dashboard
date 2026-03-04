"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-1.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full mb-2" />
          <div className="flex justify-between mb-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex justify-between mb-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <div className="flex justify-between mt-4 mb-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-10" />
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex justify-between mb-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
