"use client"

import { useParams } from "next/navigation"
import useSWR from "swr"
import { useState } from "react"
import Link from "next/link"
import { Trophy, Clock, Users, CheckCircle, XCircle, Minus } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

type ContestDetail = {
  id: string; name: string; rule: string; startAt: string; endAt: string
  phase: string; participantCount: number; registered: boolean
  problems: { order: number; label: string; id: string; slug: string; title: string; difficulty: number }[]
}

type StandingRow = {
  rank: number; userId: string; userName: string | null
  solved: number; penalty: number; score: number
  problems: Record<string, { attempts: number; accepted: boolean; acceptedAt: number | null; score: number; penalty: number }>
}

type StandingsData = {
  rule: string; phase: string; frozen: boolean
  problems: { id: string; label: string }[]
  rows: StandingRow[]
}

const phaseBadge: Record<string, { text: string; cls: string }> = {
  upcoming: { text: "即将开始", cls: "bg-blue-100 text-blue-800" },
  running: { text: "进行中", cls: "bg-green-100 text-green-800" },
  frozen: { text: "已封榜", cls: "bg-yellow-100 text-yellow-800" },
  ended: { text: "已结束", cls: "bg-gray-100 text-gray-700" },
}

export default function ContestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [tab, setTab] = useState<"problems" | "standings">("problems")

  const { data: contest, mutate } = useSWR(
    id ? ["contest", id] : null,
    () => api.contests.get<ContestDetail>(id),
  )

  const { data: standings } = useSWR(
    id && tab === "standings" && contest?.phase !== "upcoming" ? ["standings", id] : null,
    () => api.contests.standings<StandingsData>(id),
    { refreshInterval: 30000 },
  )

  const [registering, setRegistering] = useState(false)

  async function handleRegister() {
    setRegistering(true)
    try {
      await api.contests.register(id)
      toast.success("报名成功")
      mutate()
    } catch (e: any) {
      toast.error(e.message || "报名失败")
    } finally {
      setRegistering(false)
    }
  }

  if (!contest) {
    return <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground">加载中...</div>
  }

  const phase = phaseBadge[contest.phase] ?? phaseBadge.ended
  const canEnter = contest.phase === "running" || contest.phase === "frozen"

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{contest.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${phase.cls}`}>{phase.text}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-muted">{contest.rule}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(contest.startAt).toLocaleString("zh-CN")} — {new Date(contest.endAt).toLocaleString("zh-CN")}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {contest.participantCount} 人参赛
            </span>
          </div>
        </div>
        {user && !contest.registered && contest.phase !== "ended" && (
          <Button onClick={handleRegister} disabled={registering}>
            {registering ? "报名中..." : "立即报名"}
          </Button>
        )}
        {contest.registered && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> 已报名
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {(["problems", "standings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "problems" ? "题目" : "排行榜"}
          </button>
        ))}
      </div>

      {tab === "problems" && (
        <div className="space-y-2">
          {contest.problems.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              {contest.phase === "upcoming" ? "比赛开始后显示题目" : "暂无题目"}
            </p>
          )}
          {contest.problems.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-lg w-8">{p.label}</span>
                  <div>
                    <span className="font-medium">{p.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">难度 {p.difficulty}</span>
                  </div>
                </div>
                {canEnter && contest.registered && (
                  <Link href={`/problems/${p.slug}`}>
                    <Button variant="outline" size="sm">去做题</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "standings" && standings && (
        <div className="overflow-x-auto">
          {standings.frozen && (
            <div className="mb-3 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-200">
              排行榜已封榜，最终排名将在比赛结束后揭晓
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 w-12">#</th>
                <th className="text-left p-2">选手</th>
                <th className="text-center p-2 w-16">{standings.rule === "OI" ? "总分" : "通过"}</th>
                <th className="text-center p-2 w-20">{standings.rule === "OI" ? "" : "罚时"}</th>
                {standings.problems.map((p) => (
                  <th key={p.id} className="text-center p-2 w-16 font-mono">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.rows.map((row) => (
                <tr key={row.userId} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-mono">{row.rank}</td>
                  <td className="p-2 font-medium">{row.userName ?? "匿名"}</td>
                  <td className="p-2 text-center font-mono">{standings.rule === "OI" ? row.score : row.solved}</td>
                  <td className="p-2 text-center font-mono text-muted-foreground">
                    {standings.rule !== "OI" ? row.penalty : ""}
                  </td>
                  {standings.problems.map((p) => {
                    const cell = row.problems[p.id]
                    if (!cell || cell.attempts === 0) {
                      return <td key={p.id} className="p-2 text-center"><Minus className="h-3.5 w-3.5 mx-auto text-muted-foreground" /></td>
                    }
                    if (standings.rule === "OI") {
                      return (
                        <td key={p.id} className="p-2 text-center font-mono text-xs">
                          {cell.score > 0 ? <span className="text-green-600">{cell.score}</span> : <span className="text-red-500">0</span>}
                        </td>
                      )
                    }
                    return (
                      <td key={p.id} className="p-2 text-center">
                        {cell.accepted ? (
                          <div className="text-green-600 text-xs">
                            <CheckCircle className="h-3.5 w-3.5 mx-auto" />
                            <span>{cell.attempts > 1 ? `+${cell.attempts - 1}` : ""}</span>
                          </div>
                        ) : (
                          <div className="text-red-500 text-xs">
                            <XCircle className="h-3.5 w-3.5 mx-auto" />
                            <span>-{cell.attempts}</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {standings.rows.length === 0 && (
                <tr><td colSpan={4 + standings.problems.length} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "standings" && !standings && contest.phase === "upcoming" && (
        <p className="text-center py-8 text-muted-foreground">比赛开始后显示排行榜</p>
      )}
    </div>
  )
}
