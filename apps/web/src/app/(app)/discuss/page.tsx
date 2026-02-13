import { MessageSquare } from "lucide-react"

export default function DiscussPage() {
  return (
    <div className="container py-8">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">讨论</h1>
        <p className="text-muted-foreground">讨论区功能正在开发中，敬请期待...</p>
      </div>
    </div>
  )
}
