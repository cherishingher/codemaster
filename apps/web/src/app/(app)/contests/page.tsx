import Link from "next/link"
import { ArrowRight, Flag, Timer, Trophy } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const contestCards = [
  {
    title: "周赛热身场",
    desc: "按周赛节奏刷中等题，建议计时 90 分钟。",
    icon: Timer,
    actionHref: "/tracks/weekly-warmup",
    actionLabel: "进入热身专题",
  },
  {
    title: "图论专项赛前练",
    desc: "集中处理最短路、拓扑排序和图搜索题。",
    icon: Flag,
    actionHref: "/tracks/graph-advanced",
    actionLabel: "进入图论专题",
  },
  {
    title: "提交复盘看板",
    desc: "查看近期提交，快速定位高频失分点。",
    icon: Trophy,
    actionHref: "/submissions",
    actionLabel: "查看提交记录",
  },
]

export default function ContestsPage() {
  return (
    <div className="page-wrap py-10 md:py-14">
      <SectionHeading
        eyebrow="Contest"
        title="竞赛训练入口"
        description="该页为前端导航入口，帮助你从首页导航直接进入竞赛相关训练流程。"
      />

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {contestCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
                  <Icon className="size-6 text-foreground" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{card.title}</h2>
                <p className="text-sm leading-7 text-muted-foreground">{card.desc}</p>
                <Button asChild size="sm" variant="secondary">
                  <Link href={card.actionHref}>
                    {card.actionLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/problems">去题库选题</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/tracks">查看全部专题</Link>
        </Button>
      </div>
    </div>
  )
}
