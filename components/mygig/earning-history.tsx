"use client"

import { motion } from "framer-motion"
import { Briefcase, MapPin, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GigCoinIcon } from "./gig-coin-icon"

export interface EarningEntry {
  id: string
  title: string
  location: string
  date: string
  /** Сумма с знаком: положительная — начисление, отрицательная — списание (покупка). Для штрафа не используется */
  amount: number
  type: "shift" | "bonus" | "quest" | "redemption" | "strike"
  /** Для type=strike: ID смены, за которую получен штраф */
  shiftExternalId?: string | null
}

interface EarningHistoryProps {
  entries: EarningEntry[]
}

export function EarningHistory({ entries }: EarningHistoryProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Последняя активность</h2>
          <button className="text-xs text-accent hover:text-accent/80 font-medium transition-colors">
            Все
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${entry.type === "strike" ? "bg-destructive/10" : "bg-secondary/40"}`}
            >
              <div className={`flex-shrink-0 p-2 rounded-lg ${entry.type === "strike" ? "bg-destructive/20 text-destructive" : "bg-accent/15 text-accent"}`}>
                {entry.type === "strike" ? <AlertTriangle size={18} /> : <Briefcase size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${entry.type === "strike" ? "text-destructive" : "text-foreground"}`}>{entry.title}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={10} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate">{entry.location}</span>
                  <span className="text-[11px] text-muted-foreground/50 mx-1">{"/"}</span>
                  <span className="text-[11px] text-muted-foreground">{entry.date}</span>
                </div>
              </div>
              {entry.type !== "strike" && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <GigCoinIcon size={16} />
                  <span
                    className={
                      entry.amount < 0
                        ? "text-sm font-bold text-destructive tabular-nums"
                        : "text-sm font-bold text-success tabular-nums"
                    }
                  >
                    {entry.amount >= 0 ? `+${entry.amount}` : entry.amount}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
