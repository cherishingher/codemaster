"use client"

import Link from "next/link"
import useSWR from "swr"
import { useState } from "react"
import { Calendar, Clock, Trophy, Users, ArrowRight } from "lucide-react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type ContestItem = {
  id: string
  name: string
  rule: string
  startAt: string
  endAt: string
  phase: string
  participantCount: number
  problemCount: number
}

type ContestListResponse = {
  items: ContestItem[]
  total: number
  page: number
  totalPages: number
}

const phaseLabel: Record<string, { text: string; color: string }> = {
  upcoming: { text: "即将开始", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  running: { text: "进行中", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  frozen: { text: "已封榜", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  ended: { text: "已结束", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

function durationText(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`
}

export default function ContestsPage() {
  const [tab, setTab] = useState<string>("all")
  const params: Record<string, string> = {}
  if (tab !== "all") params.status = tab

  const { data, isLoading } = useSWR(
    ["contests", tab],
    () => api.contests.list<ContestListResponse>(params),
  )

  const tabs = [
    { key: "all", label: "全部" },
    { key: "running", label: "进行中" },
    { key: "upcoming", label: "即将开始" },
    { key: "ended", label: "已结束" },
  ]

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">比赛</h1>
          <p className="text-muted-foreground mt-1">参加算法竞赛，检验你的编程实力</p>
        </div>
        <Trophy className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      )}

      {data && data.items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">暂无比赛</div>
      )}

      <div className="space-y-3">
        {data?.items.map((c) => {
          const phase = phaseLabel[c.phase] ?? phaseLabel.ended
          return (
            <Link key={c.id} href={`/contests/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{c.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${phase.color}`}>
                          {phase.text}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          {c.rule}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatTime(c.startAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {durationText(c.startAt, c.endAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {c.participantCount} 人
                        </span>
                        <span>{c.problemCount} 题</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground mt-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
