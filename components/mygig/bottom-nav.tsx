"use client"

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border sm:bg-card/95 sm:backdrop-blur-md" role="navigation" aria-label="Основная навигация">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1 sm:px-2 sm:py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center py-1.5 px-2 sm:py-2 sm:px-4 rounded-xl transition-colors min-w-0"
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
            >
              {isActive && (
                <div
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  aria-hidden
                />
              )}
              <Icon
                size={18}
                className={`relative z-10 shrink-0 sm:w-5 sm:h-5 w-[18px] h-[18px] transition-colors ${
                  isActive ? "text-accent" : "text-muted-foreground"
                }`}
              />
              <span
                className={`relative z-10 text-[9px] sm:text-[10px] mt-0.5 font-medium transition-colors truncate max-w-full ${
                  isActive ? "text-accent" : "text-muted-foreground"
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
