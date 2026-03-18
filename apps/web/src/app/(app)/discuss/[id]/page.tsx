"use client"

import { useParams } from "next/navigation"
import { useState } from "react"
import useSWR from "swr"
import { Clock, User, MessageSquare, Send } from "lucide-react"
import { api } from "@/lib/api-client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

type Post = {
  id: string; title: string; content: string; createdAt: string
  user: { id: string; name: string | null }
}

type Comment = {
  id: string; content: string; createdAt: string
  user: { id: string; name: string | null }
}

type CommentsResponse = Comment[] | { items: Comment[] }

function toComments(data: CommentsResponse | undefined): Comment[] {
  if (!data) return []
  return Array.isArray(data) ? data : data.items ?? []
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: post } = useSWR(id ? ["post", id] : null, () => api.posts.get<Post>(id))
  const { data: commentsData, mutate } = useSWR(id ? ["comments", id] : null, () => api.posts.comments<CommentsResponse>(id))
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  async function handleComment() {
    if (!comment.trim()) return
    setSending(true)
    try {
      await api.posts.addComment(id, { content: comment })
      setComment("")
      toast.success("评论已提交")
      mutate()
    } catch (e: any) {
      toast.error(e.message || "评论失败")
    } finally {
      setSending(false)
    }
  }

  const comments = toComments(commentsData)

  if (!post) {
    return <div className="max-w-3xl mx-auto py-12 text-center text-muted-foreground">加载中...</div>
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <article className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{post.user?.name ?? "匿名"}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{new Date(post.createdAt).toLocaleString("zh-CN")}</span>
        </div>
        <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{post.content}</div>
      </article>

      <div className="border-t pt-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> 评论 ({comments.length})
        </h2>

        {user && (
          <div className="flex gap-2 mb-6">
            <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="写一条评论..."
              value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleComment()} />
            <Button onClick={handleComment} disabled={sending} size="sm">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{c.user?.name ?? "匿名"}</span>
                  <span>{new Date(c.createdAt).toLocaleString("zh-CN")}</span>
                </div>
                <p className="text-sm">{c.content}</p>
              </CardContent>
            </Card>
          ))}
          {comments.length === 0 && (
            <p className="text-center py-6 text-muted-foreground">暂无评论</p>
          )}
        </div>
      </div>
    </div>
  )
}
