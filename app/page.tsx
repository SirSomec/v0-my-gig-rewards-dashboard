"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Header } from "@/components/mygig/header"
import { LevelProgress } from "@/components/mygig/level-progress"
import { EarningHistory, type EarningEntry } from "@/components/mygig/earning-history"
import { Quests, type Quest } from "@/components/mygig/quests"
import { RedemptionStore, type StoreItem } from "@/components/mygig/redemption-store"
import { BottomNav, type NavTab } from "@/components/mygig/bottom-nav"
import { LevelsView } from "@/components/mygig/levels-view"

// --- Mock data ---
const USER = {
  name: "Алексей Иванов",
  level: "Серебряный партнёр",
  nextLevel: "Золотой партнёр",
  balance: 1_240,
  shiftsCompleted: 22,
  shiftsRequired: 25,
  shiftsRemaining: 3,
}

const EARNINGS: EarningEntry[] = [
  { id: "1", title: "Смена на складе - Amazon FC", location: "Ромфорд, Лондон", date: "Сегодня", coins: 50, type: "shift" },
  { id: "2", title: "Обслуживание мероприятия - O2 Arena", location: "Гринвич, Лондон", date: "Вчера", coins: 75, type: "shift" },
  { id: "3", title: "Водитель доставки - DPD", location: "Кройдон, Лондон", date: "25 фев", coins: 60, type: "shift" },
  { id: "4", title: "Помощник в магазине - Tesco", location: "Брикстон, Лондон", date: "24 фев", coins: 45, type: "shift" },
  { id: "5", title: "Бонус за выходные", location: "Системная награда", date: "23 фев", coins: 100, type: "bonus" },
]

const QUESTS: Quest[] = [
  { id: "q1", title: "Ранняя пташка", description: "Примите смену до 8 утра", progress: 1, total: 1, reward: 30, icon: "calendar", completed: true, period: "daily" },
  { id: "q2", title: "Первая смена дня", description: "Завершите хотя бы одну смену", progress: 1, total: 1, reward: 25, icon: "streak", completed: false, period: "daily" },
  { id: "q3", title: "Цель недели", description: "Завершите 5 смен за неделю", progress: 3, total: 5, reward: 150, icon: "target", completed: false, period: "weekly" },
  { id: "q4", title: "Серия смен", description: "Завершите 3 смены подряд", progress: 2, total: 3, reward: 100, icon: "streak", completed: false, period: "weekly" },
  { id: "q5", title: "Лучший работник", description: "Получите рейтинг 5 звёзд на 2 сменах", progress: 1, total: 2, reward: 75, icon: "trophy", completed: false, period: "weekly" },
]

const STORE_ITEMS: StoreItem[] = [
  { id: "s1", name: "Скидка 10% у партнёров", description: "Экономия в магазинах-партнёрах 30 дней", cost: 200, icon: "discount", category: "Скидка" },
  { id: "s2", name: "Ускоритель выплат", description: "+5% к следующим 3 выплатам за смены", cost: 500, icon: "booster", category: "Бустер" },
  { id: "s3", name: "Худи MyGig", description: "Фирменный мерч с бесплатной доставкой", cost: 1500, icon: "merch", category: "Мерч" },
  { id: "s4", name: "Подарочная карта - 10 GBP", description: "Amazon, Uber Eats или Deliveroo", cost: 800, icon: "gift", category: "Подарок" },
]

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

export default function MyGigRewards() {
  const [activeTab, setActiveTab] = useState<NavTab>("home")

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      <Header
        coinBalance={USER.balance}
        userName={USER.name}
        userLevel={USER.level}
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
                currentLevel={USER.level}
                nextLevel={USER.nextLevel}
                shiftsCompleted={USER.shiftsCompleted}
                shiftsRequired={USER.shiftsRequired}
                shiftsRemaining={USER.shiftsRemaining}
              />
              <Quests quests={QUESTS} />
              <EarningHistory entries={EARNINGS.slice(0, 3)} />
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
              <EarningHistory entries={EARNINGS} />
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
              <RedemptionStore items={STORE_ITEMS} userBalance={USER.balance} />
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
              <LevelsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
