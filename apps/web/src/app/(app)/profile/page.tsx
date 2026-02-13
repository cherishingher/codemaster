"use client"

import * as React from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
// Tabs removed until component is implemented
import { Loader2, Trophy, Clock, Target, Calendar } from "lucide-react"

// Mock stats for now
const stats = {
  rank: 12450,
  solved: {
    total: 42,
    easy: 25,
    medium: 15,
    hard: 2
  },
  recentActivity: [
    { id: '1', problem: 'Two Sum', status: 'ACCEPTED', date: '2 hours ago' },
    { id: '2', problem: 'Add Two Numbers', status: 'WRONG_ANSWER', date: '1 day ago' },
    { id: '3', problem: 'Median of Two Sorted Arrays', status: 'ACCEPTED', date: '2 days ago' },
  ]
}

export default function ProfilePage() {
  const { user, loading } = useAuth({ redirectTo: '/login' })

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* User Info Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center pt-6">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="text-2xl">{user.name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold">{user.name || "Code Master"}</h2>
              <p className="text-sm text-muted-foreground mb-4">{user.email}</p>
              <Badge variant="secondary" className="mb-2">{user.role}</Badge>
              <div className="w-full grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.rank}</div>
                  <div className="text-xs text-muted-foreground">排名</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.solved.total}</div>
                  <div className="text-xs text-muted-foreground">解决题目</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                成就
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 bg-yellow-500/10">初级刷题者</Badge>
                <Badge variant="outline" className="border-blue-500/50 text-blue-500 bg-blue-500/10">坚持不懈</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  简单题目
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{stats.solved.easy}</div>
                <p className="text-xs text-muted-foreground">已完成</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  中等题目
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{stats.solved.medium}</div>
                <p className="text-xs text-muted-foreground">已完成</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  困难题目
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{stats.solved.hard}</div>
                <p className="text-xs text-muted-foreground">已完成</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`p-2 rounded-full ${activity.status === 'ACCEPTED' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {activity.status === 'ACCEPTED' ? <Target className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-medium">{activity.problem}</div>
                        <div className="text-xs text-muted-foreground">{activity.status}</div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 pl-11 sm:pl-0">
                      <Calendar className="h-3 w-3" />
                      {activity.date}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
