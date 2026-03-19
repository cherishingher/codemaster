"use client"

import { useState } from "react"
import useSWR from "swr"
import { client } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Search, Shield, ShieldOff, Users } from "lucide-react"

type UserItem = {
  id: string; email: string | null; phone: string | null; name: string | null
  status: string; roles: string[]; submissionCount: number; createdAt: string
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const { data, mutate } = useSWR(["admin-users", q, page], () =>
    client<{ items: UserItem[]; total: number; totalPages: number }>(
      `/admin/users?page=${page}&q=${encodeURIComponent(q)}`
    )
  )

  async function toggleRole(userId: string, role: string, has: boolean) {
    try {
      await client("/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, role, action: has ? "revoke" : "grant" }),
      })
      toast.success(has ? `已撤销 ${role}` : `已授予 ${role}`)
      mutate()
    } catch (e: any) {
      toast.error(e.message || "操作失败")
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
        <Users className="h-6 w-6" /> 用户管理
      </h1>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full border rounded pl-9 pr-3 py-2 text-sm"
            placeholder="搜索邮箱/手机号/姓名..."
            value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-3">
        共 {data?.total ?? 0} 个用户
      </div>

      <div className="space-y-2">
        {data?.items.map((u) => {
          const isAdmin = u.roles.includes("admin")
          return (
            <Card key={u.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.name || "未设置姓名"}</span>
                    {u.roles.map((r) => (
                      <span key={r} className="text-xs bg-muted px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {u.email || u.phone || u.id} · {u.submissionCount} 次提交 · 注册于 {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => toggleRole(u.id, "admin", isAdmin)}
                >
                  {isAdmin ? <ShieldOff className="h-4 w-4 mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
                  {isAdmin ? "撤销管理员" : "设为管理员"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm py-2">{page} / {data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  )
}
