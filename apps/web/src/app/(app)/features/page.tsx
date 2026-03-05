import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HOME_FEATURES } from "@/lib/home-features"

export default function FeaturesPage() {
  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Capabilities</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">平台能力模块</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            首页能力卡片对应的详情入口，方便你从导航中快速进入对应功能页面。
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
        eyebrow="Feature Map"
        title="能力与入口一览"
        description="点击任意模块，进入该能力的详细说明和快捷跳转。"
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {HOME_FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <Card key={feature.slug} className="bg-background">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start gap-4">
                  <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${feature.tone}`}>
                    <Icon className="size-7 text-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{feature.title}</h2>
                    <p className="text-sm leading-7 text-muted-foreground">{feature.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <Link href={`/features/${feature.slug}`}>
                      查看详情
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={feature.primaryHref}>进入功能入口</Link>
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
