"use client"

import { useState, useEffect, useCallback } from "react"
import {
  adminListQuests,
  adminListUsers,
  adminCompleteManualQuestForUser,
} from "@/lib/admin-api"
import type { AdminQuest, AdminUser } from "@/lib/admin-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, ShieldCheck, User } from "lucide-react"

const USER_PAGE_SIZE = 50

export default function QuestModerationPage() {
  const [quests, setQuests] = useState<AdminQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState("")
  const [userSearchDebounced, setUserSearchDebounced] = useState("")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [completing, setCompleting] = useState<{ questId: number; userId: number } | null>(null)
  const [completeResult, setCompleteResult] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setUserSearchDebounced(userSearch), 400)
    return () => clearTimeout(t)
  }, [userSearch])

  const loadQuests = useCallback(() => {
    setLoading(true)
    setError(null)
    adminListQuests()
      .then((list) => {
        const manual = list.filter((q) => q.conditionType === "manual_confirmation" && q.isActive === 1)
        setQuests(manual)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadQuests()
  }, [loadQuests])

  useEffect(() => {
    if (!userSearchDebounced.trim()) {
      setUsers([])
      return
    }
    setUsersLoading(true)
    adminListUsers({
      search: userSearchDebounced.trim(),
      page: 1,
      pageSize: USER_PAGE_SIZE,
    })
      .then((res) => setUsers(res.items))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false))
  }, [userSearchDebounced])

  const handleComplete = (questId: number, userId: number) => {
    setCompleting({ questId, userId })
    setCompleteResult(null)
    adminCompleteManualQuestForUser(questId, userId)
      .then((res) => {
        if (res.alreadyCompleted) {
          setCompleteResult("Квест уже был выполнен этим пользователем в текущем периоде.")
        } else {
          setCompleteResult("Выполнение засчитано, награда начислена.")
        }
      })
      .catch((e) => setCompleteResult(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => {
        setCompleting(null)
      })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">Модерация квестов</h1>
          <p className="text-sm text-muted-foreground">
            Подтверждение выполнения квестов с типом «Ручное подтверждение» для пользователей
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : quests.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Нет активных квестов с типом условия «Ручное подтверждение». Создайте такой квест в разделе Квесты.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {quests.map((quest) => (
            <Card key={quest.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  {quest.name}
                  <span className="text-sm font-normal text-muted-foreground">
                    +{quest.rewardCoins} монет
                  </span>
                </CardTitle>
                {quest.description && (
                  <p className="text-sm text-muted-foreground">{quest.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Период: {quest.period === "daily" ? "ежедневный" : quest.period === "weekly" ? "еженедельный" : "ежемесячный"}
                  {quest.isOneTime === 1 ? " · единоразовый" : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`user-search-${quest.id}`}>Пользователь</Label>
                  <Input
                    id={`user-search-${quest.id}`}
                    type="text"
                    placeholder="Поиск по ID, имени, email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                {userSearchDebounced.trim() && (
                  <div className="space-y-2">
                    <Label>Выберите пользователя и нажмите «Подтвердить»</Label>
                    {usersLoading ? (
                      <Skeleton className="h-24" />
                    ) : users.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Никого не найдено</p>
                    ) : (
                      <ul className="border rounded-md divide-y max-h-48 overflow-y-auto">
                        {users.map((u) => (
                          <li
                            key={u.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">
                                {u.name || `ID ${u.id}`}
                                {u.externalId && (
                                  <span className="text-muted-foreground text-xs ml-1">
                                    ({u.externalId})
                                  </span>
                                )}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleComplete(quest.id, u.id)}
                              disabled={
                                completing !== null &&
                                (completing.questId !== quest.id || completing.userId !== u.id)
                              }
                            >
                              {completing?.questId === quest.id && completing?.userId === u.id ? (
                                "…"
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Подтвердить
                                </>
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {completeResult && (
                  <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                    {completeResult}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
