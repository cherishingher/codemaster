"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { MessageSquare, Plus, Clock, User } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

type PostItem = {
  id: string; title: string; content: string; status: string
  createdAt: string; user: { id: string; name: string | null }
  _count?: { comments: number }
}

type PostListResponse = PostItem[] | { items: PostItem[] }

function toArray(data: PostListResponse | undefined): PostItem[] {
  if (!data) return []
  return Array.isArray(data) ? data : data.items ?? []
}

export default function DiscussPage() {
  const { user } = useAuth()
  const { data, mutate } = useSWR("posts", () => api.posts.list<PostListResponse>())
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handlePost() {
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    try {
      await api.posts.create({ title, content })
      toast.success("帖子已提交，等待审核")
      setTitle("")
      setContent("")
      setShowForm(false)
      mutate()
    } catch (e: any) {
      toast.error(e.message || "发帖失败")
    } finally {
      setSubmitting(false)
    }
  }

  const posts = toArray(data)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">讨论区</h1>
          <p className="text-muted-foreground mt-1">分享题解、交流经验、互帮互助</p>
        </div>
        {user && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> 发帖
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-3">
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="帖子标题"
              value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[120px]" placeholder="帖子内容（支持 Markdown）"
              value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handlePost} disabled={submitting}>{submitting ? "发送中..." : "发布"}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {posts.map((p) => (
          <Link key={p.id} href={`/discuss/${p.id}`}>
            <Card className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.user?.name ?? "匿名"}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(p.createdAt).toLocaleDateString("zh-CN")}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p._count?.comments ?? 0} 评论</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">暂无帖子，来发第一篇吧</p>
        )}
      </div>
    </div>
  )
}
