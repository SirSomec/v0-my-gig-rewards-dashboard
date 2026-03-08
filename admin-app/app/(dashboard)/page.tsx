"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DashboardHomePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/users")
  }, [router])
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-muted-foreground">Перенаправление...</p>
    </div>
  )
}
