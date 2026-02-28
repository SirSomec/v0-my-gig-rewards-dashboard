"use client"

import { motion } from "framer-motion"
import { ShoppingBag, Percent, Rocket, Gift } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GigCoinIcon } from "./gig-coin-icon"

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export interface StoreItem {
  id: string
  name: string
  description: string
  cost: number
  icon: "discount" | "booster" | "merch" | "gift"
  category: string
}

const iconMap = {
  discount: Percent,
  booster: Rocket,
  merch: ShoppingBag,
  gift: Gift,
}

interface RedemptionStoreProps {
  items: StoreItem[]
  userBalance: number
}

export function RedemptionStore({ items, userBalance }: RedemptionStoreProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Rewards Store</h2>
          <div className="flex items-center gap-1">
            <GigCoinIcon size={14} />
            <span className="text-xs font-semibold text-primary tabular-nums">{formatNumber(userBalance)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {items.map((item, i) => {
            const Icon = iconMap[item.icon]
            const canAfford = userBalance >= item.cost

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="flex flex-col p-3 bg-secondary/40 rounded-xl border border-transparent hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-accent/15 text-accent">
                    <Icon size={16} />
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight mb-0.5">{item.name}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mb-3 flex-1">{item.description}</p>
                <Button
                  size="sm"
                  variant={canAfford ? "default" : "secondary"}
                  disabled={!canAfford}
                  className={`w-full h-7 text-[11px] font-semibold rounded-lg ${
                    canAfford
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <GigCoinIcon size={12} />
                  <span className="ml-1">{item.cost}</span>
                </Button>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
