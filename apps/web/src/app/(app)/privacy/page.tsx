import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SectionHeading } from "@/components/patterns/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function PrivacyPage() {
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
          title="隐私说明"
          description="该页面为前端展示页，说明平台账号与训练数据的使用边界。"
        />
        <Card className="mt-6 bg-background">
          <CardContent className="space-y-4 p-6 text-sm leading-7 text-muted-foreground">
            <p>我们仅在提供题库训练、提交评测和账号服务所需范围内处理你的数据。</p>
            <p>账号信息用于登录认证，提交记录用于展示训练进度与评测结果。</p>
            <p>如果你需要删除个人数据，请联系平台管理员处理。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
