import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen, Clock3, Star, Users } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HOME_TRACKS } from "@/lib/home-tracks"

export default function TracksPage() {
  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Training Tracks</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">全部刷题专题</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            按训练目标划分的专题入口。点击卡片进入专题详情，再直接进入题库筛选与提交流程。
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/">
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
        </Button>
      </div>

      <SectionHeading
        eyebrow="热门专题"
        title="选择一个专题开始训练"
        description="专题详情页已补齐，你可以从这里直接进入对应入口。"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {HOME_TRACKS.map((track) => {
          const Icon = track.icon
          return (
            <Card key={track.slug} className="bg-background transition-transform hover:-translate-y-0.5">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className={`flex size-16 items-center justify-center rounded-2xl ${track.tone}`}>
                      <Icon className="size-7 text-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{track.title}</h2>
                      <p className="text-sm text-muted-foreground">维护：{track.author}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border-2 border-primary/80 px-3 py-1 text-sm font-semibold text-primary">
                    <Star className="size-4 fill-current" />
                    {track.rating}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
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

                <p className="text-sm leading-7 text-muted-foreground">{track.description}</p>

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/tracks/${track.slug}`}>
                      进入专题
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={track.primaryHref}>直接去刷题</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
