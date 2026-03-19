"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { client } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { GraduationCap, Plus, Users, BookOpen, LogIn } from "lucide-react"

type ClassroomItem = { id: string; name: string; memberCount: number; assignmentCount: number; inviteCode?: string; teacher?: { name: string | null }; role?: string }
type ClassroomData = { joined: ClassroomItem[]; teaching: ClassroomItem[] }

export default function ClassroomsPage() {
  const { user } = useAuth()
  const { data, mutate } = useSWR(user ? "classrooms" : null, () => client<ClassroomData>("/classrooms"))
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [name, setName] = useState("")
  const [joinId, setJoinId] = useState("")
  const [joinCode, setJoinCode] = useState("")

  async function handleCreate() {
    try {
      const res = await client<{ id: string; inviteCode: string }>("/classrooms", {
        method: "POST", body: JSON.stringify({ name }),
      })
      toast.success(`班级已创建，邀请码: ${res.inviteCode}`)
      setShowCreate(false); setName(""); mutate()
    } catch (e: any) { toast.error(e.message || "创建失败") }
  }

  async function handleJoin() {
    try {
      await client(`/classrooms/${joinId}/join`, {
        method: "POST", body: JSON.stringify({ inviteCode: joinCode }),
      })
      toast.success("加入成功")
      setShowJoin(false); setJoinId(""); setJoinCode(""); mutate()
    } catch (e: any) { toast.error(e.message || "加入失败") }
  }

  if (!user) return <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">请先登录</div>

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="h-6 w-6" /> 我的班级</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowJoin(!showJoin)}><LogIn className="h-4 w-4 mr-1" /> 加入班级</Button>
          <Button onClick={() => setShowCreate(!showCreate)}><Plus className="h-4 w-4 mr-1" /> 创建班级</Button>
        </div>
      </div>

      {showCreate && (
        <Card className="mb-4"><CardContent className="p-4 flex gap-2">
          <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="班级名称" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={handleCreate}>创建</Button>
        </CardContent></Card>
      )}
      {showJoin && (
        <Card className="mb-4"><CardContent className="p-4 flex gap-2">
          <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="班级 ID" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
          <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="邀请码" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
          <Button onClick={handleJoin}>加入</Button>
        </CardContent></Card>
      )}

      {data?.teaching && data.teaching.length > 0 && (
        <>
          <h2 className="font-semibold text-lg mb-3">我教的班</h2>
          <div className="space-y-2 mb-6">
            {data.teaching.map((c) => (
              <Link key={c.id} href={`/classrooms/${c.id}`}>
                <Card className="hover:shadow-sm cursor-pointer"><CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{c.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      邀请码: {c.inviteCode} · <Users className="inline h-3 w-3" /> {c.memberCount} 人 · <BookOpen className="inline h-3 w-3" /> {c.assignmentCount} 作业
                    </div>
                  </div>
                </CardContent></Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {data?.joined && data.joined.length > 0 && (
        <>
          <h2 className="font-semibold text-lg mb-3">我加入的班</h2>
          <div className="space-y-2">
            {data.joined.map((c) => (
              <Link key={c.id} href={`/classrooms/${c.id}`}>
                <Card className="hover:shadow-sm cursor-pointer"><CardContent className="p-3">
                  <span className="font-medium">{c.name}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    教师: {c.teacher?.name ?? "未知"} · <Users className="inline h-3 w-3" /> {c.memberCount} 人
                  </div>
                </CardContent></Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {data && !data.teaching?.length && !data.joined?.length && (
        <p className="text-center py-12 text-muted-foreground">还没有加入任何班级</p>
      )}
    </div>
  )
}
