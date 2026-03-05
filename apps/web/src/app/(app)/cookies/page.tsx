import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function CookiesPage() {
  return (
    <div className="page-wrap py-10 md:py-14">
      <Button asChild variant="secondary" size="sm">
        <Link href="/">
          <ArrowLeft className="size-4" />
          返回首页
        </Link>
      </Button>

      <section className="mt-6">
        <SectionHeading
          eyebrow="Policy"
          title="Cookie 说明"
          description="该页面为前端展示页，说明 Cookie 在登录和界面体验中的用途。"
        />
        <Card className="mt-6 bg-background">
          <CardContent className="space-y-4 p-6 text-sm leading-7 text-muted-foreground">
            <p>平台使用必要 Cookie 维持登录态、保存基础会话信息和页面偏好。</p>
            <p>这些 Cookie 仅用于提供功能，不用于第三方广告跟踪。</p>
            <p>你可以在浏览器设置中清理 Cookie，但这会导致需要重新登录。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
