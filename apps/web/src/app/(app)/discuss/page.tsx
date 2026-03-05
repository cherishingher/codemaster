import Link from "next/link"
import { ArrowRight, BookOpenText, MessageSquare, Users } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const discussPanels = [
  {
    title: "题解交流",
    desc: "围绕题目思路、复杂度与边界条件进行讨论。",
    icon: MessageSquare,
    href: "/problems",
  },
  {
    title: "训练路线分享",
    desc: "分享你在不同专题下的训练节奏与复盘方法。",
    icon: BookOpenText,
    href: "/tracks",
  },
  {
    title: "学习小组协作",
    desc: "和同伴一起练题，统一在提交记录页追踪进度。",
    icon: Users,
    href: "/submissions",
  },
]

export default function DiscussPage() {
  return (
    <div className="page-wrap py-10 md:py-14">
      <SectionHeading
        eyebrow="Discuss"
        title="讨论区入口"
        description="该页用于承接导航按钮，当前提供前端入口到题库、专题和提交页面。"
      />

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {discussPanels.map((panel) => {
          const Icon = panel.icon
          return (
            <Card key={panel.title} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex size-12 items-center justify-center rounded-xl bg-accent">
                  <Icon className="size-6 text-foreground" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{panel.title}</h2>
                <p className="text-sm leading-7 text-muted-foreground">{panel.desc}</p>
                <Button asChild size="sm" variant="secondary">
                  <Link href={panel.href}>
                    前往
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
