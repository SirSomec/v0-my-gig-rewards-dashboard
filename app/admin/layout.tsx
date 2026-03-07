"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, ShoppingBag, Gift, Layers, Zap, Target, Wallet, FileText, LayoutDashboard, Settings, Database, Briefcase } from "lucide-react"
import { cn } from "@/lib/utils"
import { ViewAsUser } from "@/components/admin/view-as-user"

const nav = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/redemptions", label: "Заявки на обмен", icon: Gift },
  { href: "/admin/store", label: "Магазин", icon: ShoppingBag },
  { href: "/admin/quests", label: "Квесты", icon: Target },
  { href: "/admin/levels", label: "Уровни", icon: Layers },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
  { href: "/admin/balance", label: "Ручные начисления", icon: Wallet },
  { href: "/admin/audit", label: "Аудит", icon: FileText },
  { href: "/admin/etl-explorer", label: "Данные ETL", icon: Database },
  { href: "/admin/mock-toj", label: "Мок TOJ (смены)", icon: Briefcase },
  { href: "/admin/dev", label: "Мок: смены и штрафы", icon: Zap },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background flex">
      {/* Левое боковое меню — фиксированная ширина на десктопе */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          "w-56 min-w-[14rem] max-w-[16rem]",
          "bg-card border-r border-border",
          "hidden sm:flex"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/admin" className="font-semibold text-foreground truncate">
            Админ-панель
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"))
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
        <div className="shrink-0 border-t border-border p-3 space-y-3">
          <ViewAsUser />
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
          >
            ← Дашборд
          </Link>
        </div>
      </aside>

      {/* На мобильных — верхняя шапка с меню (бургер или горизонтальный скролл) */}
      <header className="sm:hidden sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
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
        <nav className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"))
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
        <div className="mt-3 sm:hidden">
          <ViewAsUser />
        </div>
      </header>

      {/* Основной контент — адаптивный отступ слева на десктопе */}
      <main className="flex-1 min-w-0 sm:pl-56 min-h-screen flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
