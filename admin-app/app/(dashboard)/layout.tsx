"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, ShoppingBag, Gift, Layers, Zap, Target, Wallet, FileText, LayoutDashboard, Settings, Database, Briefcase, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Обзор", icon: LayoutDashboard },
  { href: "/users", label: "Пользователи", icon: Users },
  { href: "/redemptions", label: "Заявки на обмен", icon: Gift },
  { href: "/store", label: "Магазин", icon: ShoppingBag },
  { href: "/quests", label: "Квесты", icon: Target },
  { href: "/quest-moderation", label: "Модерация квестов", icon: ShieldCheck },
  { href: "/levels", label: "Уровни", icon: Layers },
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/balance", label: "Ручные начисления", icon: Wallet },
  { href: "/audit", label: "Аудит", icon: FileText },
  { href: "/etl-explorer", label: "Данные ETL", icon: Database },
  { href: "/mock-toj", label: "Мок TOJ (смены)", icon: Briefcase },
  { href: "/dev", label: "Мок: смены и штрафы", icon: Zap },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          "w-56 min-w-[14rem] max-w-[16rem]",
          "bg-card border-r border-border",
          "hidden sm:flex"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/" className="font-semibold text-foreground truncate">
            Админ-панель
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      <header className="sm:hidden sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-semibold text-foreground">
            Админ-панель
          </Link>
        </div>
        <nav className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href + "/"))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="flex-1 min-w-0 sm:pl-56 min-h-screen flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
