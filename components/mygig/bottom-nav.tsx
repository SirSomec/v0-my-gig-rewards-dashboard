"use client"

import { motion } from "framer-motion"
import { Home, Clock, ShoppingBag, Award } from "lucide-react"

export type NavTab = "home" | "history" | "store" | "levels"

interface BottomNavProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
}

const tabs: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Главная", icon: Home },
  { id: "history", label: "История", icon: Clock },
  { id: "store", label: "Магазин", icon: ShoppingBag },
  { id: "levels", label: "Уровни", icon: Award },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border" role="navigation" aria-label="Основная навигация">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-colors"
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon
                size={20}
                className={`relative z-10 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span
                className={`relative z-10 text-[10px] mt-0.5 font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
