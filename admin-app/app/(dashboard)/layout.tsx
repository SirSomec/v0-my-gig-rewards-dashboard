"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, ShoppingBag, Gift, Layers, Zap, Target, Wallet, FileText, LayoutDashboard, Settings, Briefcase, ShieldCheck, UsersRound, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminAuthMe, type AdminPermissionKey, type AdminSessionUser } from "@/lib/admin-api"

const nav: { href: string; label: string; icon: typeof LayoutDashboard; permission: AdminPermissionKey }[] = [
  { href: "/", label: "Обзор", icon: LayoutDashboard, permission: "overview" },
  { href: "/users", label: "Пользователи", icon: Users, permission: "users" },
  { href: "/redemptions", label: "Заявки на обмен", icon: Gift, permission: "redemptions" },
  { href: "/store", label: "Магазин", icon: ShoppingBag, permission: "store" },
  { href: "/quests", label: "Квесты", icon: Target, permission: "quests" },
  { href: "/user-groups", label: "Группы пользователей", icon: UsersRound, permission: "user_groups" },
  { href: "/quest-moderation", label: "Модерация квестов", icon: ShieldCheck, permission: "quest_moderation" },
  { href: "/levels", label: "Уровни", icon: Layers, permission: "levels" },
  { href: "/settings", label: "Настройки", icon: Settings, permission: "settings" },
  { href: "/balance", label: "Ручные начисления", icon: Wallet, permission: "balance" },
  { href: "/audit", label: "Аудит", icon: FileText, permission: "audit" },
  { href: "/admin-users", label: "Пользователи админки", icon: UserCog, permission: "admin_users" },
  { href: "/mock-toj", label: "Мок TOJ (смены)", icon: Briefcase, permission: "mock_toj" },
  { href: "/dev", label: "Мок: смены и штрафы", icon: Zap, permission: "dev" },
]

function canAccess(user: AdminSessionUser | null, permission: AdminPermissionKey): boolean {
  if (!user) return true
  if (user.isSuper) return true
  return user.permissions.includes(permission)
}

const pathToPermission: Record<string, AdminPermissionKey> = {
  "/": "overview",
  "/users": "users",
  "/redemptions": "redemptions",
  "/store": "store",
  "/quests": "quests",
  "/user-groups": "user_groups",
  "/quest-moderation": "quest_moderation",
  "/levels": "levels",
  "/settings": "settings",
  "/balance": "balance",
  "/audit": "audit",
  "/admin-users": "admin_users",
  "/mock-toj": "mock_toj",
  "/dev": "dev",
  "/etl-explorer": "etl_explorer",
}

function getPermissionForPath(pathname: string): AdminPermissionKey | null {
  if (pathToPermission[pathname]) return pathToPermission[pathname]
  for (const [path, perm] of Object.entries(pathToPermission)) {
    if (path !== "/" && pathname.startsWith(path + "/")) return perm
  }
  return null
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [user, setUser] = useState<AdminSessionUser | null | undefined>(undefined)

  useEffect(() => {
    adminAuthMe().then(setUser)
  }, [])

  const permForPath = getPermissionForPath(pathname)
  useEffect(() => {
    if (user !== undefined && user !== null && permForPath !== null && !canAccess(user, permForPath)) {
      window.location.replace("/")
    }
  }, [user, pathname, permForPath])

  const visibleNav = user === undefined ? nav : nav.filter((item) => canAccess(user ?? null, item.permission))

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
          {visibleNav.map(({ href, label, icon: Icon }) => {
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
          {visibleNav.map(({ href, label, icon: Icon }) => {
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
