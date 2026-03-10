"use client"

import { motion } from "framer-motion"
import { Bell, Sun, Moon, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GigCoinIcon } from "./gig-coin-icon"

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

interface HeaderProps {
  coinBalance: number
  userName: string
  userLevel: string
  avatarUrl?: string
  /** При выходе: кнопка «Выйти» (полная деавторизация на устройстве) */
  onLogout?: () => void
}

export function Header({ coinBalance, userName, userLevel, avatarUrl, onLogout }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/40">
            <AvatarImage src={avatarUrl} alt={`${userName}'s avatar`} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs sm:text-sm font-semibold">
              {userName.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">{userName}</span>
            <Badge
              variant="outline"
              className="mt-0.5 w-fit text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 border-primary/30 text-primary font-medium"
            >
              {userLevel}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <motion.div
            className="flex items-center gap-1 sm:gap-1.5 bg-secondary rounded-full px-2 py-1 sm:px-3 sm:py-1.5"
            whileTap={{ scale: 0.95 }}
          >
            <GigCoinIcon size={18} className="flex-shrink-0" />
            <motion.span
              key={coinBalance}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-xs sm:text-sm font-bold text-primary tabular-nums"
            >
              {formatNumber(coinBalance)}
            </motion.span>
          </motion.div>
          {onLogout && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={onLogout}
              aria-label="Выйти"
            >
              <LogOut size={18} className="shrink-0" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <button
            className="relative p-1.5 sm:p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label="Уведомления"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </header>
  )
}
