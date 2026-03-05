import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HOME_FEATURES, getFeatureBySlug } from "@/lib/home-features"

type FeatureDetailPageProps = {
  params: Promise<{ slug: string }>
}

export default async function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { slug } = await params
  const feature = getFeatureBySlug(slug)

  if (!feature) {
    notFound()
  }

  const Icon = feature.icon
  const relatedFeatures = HOME_FEATURES.filter((item) => item.slug !== feature.slug).slice(0, 3)

  return (
    <div className="page-wrap py-10 md:py-14">
      <Button asChild variant="secondary" size="sm">
        <Link href="/features">
          <ArrowLeft className="size-4" />
          返回能力列表
        </Link>
      </Button>

      <Card className="mt-6 bg-background">
        <CardContent className="space-y-6 p-7 md:p-10">
          <div className="flex items-start gap-5">
            <div className={`flex size-18 shrink-0 items-center justify-center rounded-[1.5rem] ${feature.tone}`}>
              <Icon className="size-8 text-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Feature Detail</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{feature.title}</h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{feature.description}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/20 p-5">
            <p className="text-sm font-semibold text-foreground">这个模块可以帮你：</p>
            <div className="mt-3 space-y-2">
              {feature.highlights.map((line) => (
                <p key={line} className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{line}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={feature.primaryHref}>
                进入主入口
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={feature.secondaryHref}>查看关联入口</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-12">
        <SectionHeading
          eyebrow="Related"
          title="更多能力模块"
          description="你可以继续查看其他模块，不需要返回首页。"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {relatedFeatures.map((item) => (
            <Card key={item.slug} className="bg-background">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/features/${item.slug}`}>查看详情</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
