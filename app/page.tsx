"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Header } from "@/components/mygig/header"
import { LevelProgress } from "@/components/mygig/level-progress"
import { EarningHistory } from "@/components/mygig/earning-history"
import { Quests } from "@/components/mygig/quests"
import { RedemptionStore } from "@/components/mygig/redemption-store"
import { BottomNav, type NavTab } from "@/components/mygig/bottom-nav"
import { LevelsView } from "@/components/mygig/levels-view"
import { DashboardSkeleton } from "@/components/mygig/dashboard-skeleton"
import { useRewardsDashboard } from "@/hooks/use-rewards-dashboard"
import { getApiConfigForDisplay } from "@/lib/rewards-api"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

export default function MyGigRewards() {
  const [activeTab, setActiveTab] = useState<NavTab>("home")
  const { user, transactions, quests, storeItems, loading, error, refetch, purchaseItem, logout, isLoggedIn } = useRewardsDashboard()

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
        <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
              <div className="flex flex-col gap-1">
                <div className="h-4 w-28 bg-secondary rounded animate-pulse" />
                <div className="h-4 w-24 bg-secondary rounded animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-20 bg-secondary rounded-full animate-pulse" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
          <DashboardSkeleton />
        </main>
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-14 bg-card border-t border-border" />
      </div>
    )
  }

  if (error && !user) {
    const { apiUrl, hasDevUserId } = getApiConfigForDisplay()
    return (
      <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
        <main className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
          <div className="p-4 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={32} />
          </div>
          <p className="text-sm text-muted-foreground text-center">{error}</p>
          <p className="text-xs text-muted-foreground text-center">
            Убедитесь, что бэкенд запущен и в <code className="bg-muted px-1 rounded">.env</code> заданы{" "}
            <code className="bg-muted px-1 rounded">NEXT_PUBLIC_REWARDS_API_URL</code> и{" "}
            <code className="bg-muted px-1 rounded">NEXT_PUBLIC_DEV_USER_ID</code>.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Сейчас: API = {apiUrl}, DEV_USER_ID = {hasDevUserId ? "задан" : "не задан"}.
          </p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            После клонирования из Git выполните <code className="bg-muted px-1 rounded">npm install</code> (создастся .env из .env.example), при необходимости отредактируйте .env и перезапустите <code className="bg-muted px-1 rounded">npm run dev</code>.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
        </main>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      <Header
        coinBalance={user.balance}
        userName={user.name}
        userLevel={user.level}
        avatarUrl={user.avatarUrl}
        onLogout={isLoggedIn ? logout : undefined}
      />

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <LevelProgress
                currentLevel={user.level}
                nextLevel={user.nextLevel}
                shiftsCompleted={user.shiftsCompleted}
                shiftsRequired={user.shiftsRequired}
                shiftsRemaining={user.shiftsRemaining}
                strikesCount={user.strikesCount}
                strikesThreshold={user.strikesThreshold}
                strikesCountWeek={user.strikesCountWeek}
                strikesCountMonth={user.strikesCountMonth}
                strikesLimitPerWeek={user.strikesLimitPerWeek}
                strikesLimitPerMonth={user.strikesLimitPerMonth}
              />
              <Quests quests={quests} />
              <EarningHistory entries={transactions.slice(0, 3)} />
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div
              key="history"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <EarningHistory entries={transactions} />
            </motion.div>
          )}

          {activeTab === "store" && (
            <motion.div
              key="store"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <RedemptionStore
                items={storeItems}
                userBalance={user.balance}
                onPurchase={purchaseItem}
              />
            </motion.div>
          )}

          {activeTab === "levels" && (
            <motion.div
              key="levels"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              <LevelsView currentLevelName={user.level} shiftsCompleted={user.shiftsCompleted} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
