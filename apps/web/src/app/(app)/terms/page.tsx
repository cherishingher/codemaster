import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function TermsPage() {
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
          title="使用条款"
          description="该页面为前端展示页，约定平台使用与内容提交的基本规则。"
        />
        <Card className="mt-6 bg-background">
          <CardContent className="space-y-4 p-6 text-sm leading-7 text-muted-foreground">
            <p>用户需遵守平台发布的训练规范，不得提交恶意代码或破坏性内容。</p>
            <p>题目、测试数据和界面内容仅用于学习与训练，不得未经授权对外分发。</p>
            <p>平台可在必要时调整规则并更新本页说明。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
