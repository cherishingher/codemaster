import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  LineChart,
  PlayCircle,
  Star,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SectionHeading } from "@/components/patterns/section-heading"
import { HOME_TRACKS, getTrackBySlug } from "@/lib/home-tracks"

type TrackDetailPageProps = {
  params: Promise<{ slug: string }>
}

const stageTemplates = [
  {
    title: "阶段 1：热身",
    summary: "先做基础题建立节奏，熟悉题面与提交反馈。",
  },
  {
    title: "阶段 2：强化",
    summary: "聚焦专题核心题型，提升稳定通过率和调试效率。",
  },
  {
    title: "阶段 3：复盘",
    summary: "回看提交记录和错题，形成下一轮训练清单。",
  },
]

export default async function TrackDetailPage({ params }: TrackDetailPageProps) {
  const { slug } = await params
  const track = getTrackBySlug(slug)

  if (!track) {
    notFound()
  }

  const Icon = track.icon
  const relatedTracks = HOME_TRACKS.filter((item) => item.slug !== track.slug).slice(0, 3)

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8">
        <Button asChild variant="secondary" size="sm">
          <Link href="/tracks">
            <ArrowLeft className="size-4" />
            返回专题列表
          </Link>
        </Button>
      </div>

      <Card className="bg-background">
        <CardContent className="space-y-6 p-7 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 flex-1 gap-4">
              <div className={`flex size-18 shrink-0 items-center justify-center rounded-[1.5rem] ${track.tone}`}>
                <Icon className="size-8 text-foreground" />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">专题详情</p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{track.title}</h1>
                <p className="text-sm text-muted-foreground">维护：{track.author}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-primary/80 px-4 py-2 text-base font-semibold text-primary">
              <Star className="size-4 fill-current" />
              {track.rating}
            </div>
          </div>

          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <BookOpen className="size-4" />
              {track.lessons}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4" />
              {track.duration}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="size-4" />
              {track.learners}
            </span>
          </div>

          <p className="max-w-4xl text-base leading-8 text-muted-foreground">{track.description}</p>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={track.primaryHref}>
                开始本专题训练
                <PlayCircle className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={track.secondaryHref}>
                查看相关页面
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-12">
        <SectionHeading
          eyebrow="训练路径"
          title="建议学习节奏"
          description="以下模块是前端引导视图，便于从专题直接进入题库、提交和复盘页面。"
        />
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {stageTemplates.map((stage) => (
            <Card key={stage.title} className="bg-background">
              <CardContent className="space-y-3 p-6">
                <div className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary">
                  <LineChart className="size-5 text-foreground" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{stage.title}</h2>
                <p className="text-sm leading-7 text-muted-foreground">{stage.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="更多专题"
          title="继续探索其他训练方向"
          description="你可以快速跳到其他专题，不需要返回首页。"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {relatedTracks.map((item) => (
            <Card key={item.slug} className="bg-background">
              <CardContent className="space-y-3 p-5">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.lessons}</p>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/tracks/${item.slug}`}>查看专题</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
