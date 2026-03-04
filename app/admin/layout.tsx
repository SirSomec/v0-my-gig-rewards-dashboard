"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, ShoppingBag, Gift, Layers, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/redemptions", label: "Заявки на обмен", icon: Gift },
  { href: "/admin/store", label: "Магазин", icon: ShoppingBag },
  { href: "/admin/levels", label: "Уровни", icon: Layers },
  { href: "/admin/dev", label: "Мок: смены и штрафы", icon: Zap },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-4xl mx-auto">
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="font-semibold text-foreground">
            Админ-панель
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Дашборд
          </Link>
        </div>
        <nav className="flex flex-wrap gap-2 mt-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
