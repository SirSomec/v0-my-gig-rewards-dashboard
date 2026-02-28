"use client"

import { motion } from "framer-motion"
import { Bell, Sun, Moon } from "lucide-react"
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
}

export function Header({ coinBalance, userName, userLevel, avatarUrl }: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/40">
            <AvatarImage src={avatarUrl} alt={`${userName}'s avatar`} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
              {userName.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground leading-tight">{userName}</span>
            <Badge
              variant="outline"
              className="mt-0.5 w-fit text-[10px] px-1.5 py-0 border-primary/30 text-primary font-medium"
            >
              {userLevel}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5"
            whileTap={{ scale: 0.95 }}
          >
            <GigCoinIcon size={20} />
            <motion.span
              key={coinBalance}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-sm font-bold text-primary tabular-nums"
            >
              {formatNumber(coinBalance)}
            </motion.span>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <button
            className="relative p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Уведомления"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          </button>
        </div>
      </div>
    </header>
  )
}
