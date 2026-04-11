"use client"

import Link from "next/link"
import {
  FlaskConical,
  GraduationCap,
  LayoutPanelTop,
  Package,
  PlayCircle,
  Route,
  School,
  ShoppingBag,
  Users,
  Video,
  Workflow,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"

const secondarySections = [
  {
    id: "content",
    title: "内容运营",
    description: "题解、视频、训练路径和审核流转，适合内容编辑和教研运营低频进入。",
    icon: LayoutPanelTop,
    links: [
      { href: "/admin/content", label: "内容后台首页", icon: LayoutPanelTop },
      { href: "/admin/content/solutions", label: "题解管理", icon: PlayCircle },
      { href: "/admin/content/videos", label: "视频资源", icon: Video },
      { href: "/admin/content/paths", label: "训练路径", icon: Route },
      { href: "/admin/content/workflow", label: "审核日志", icon: Workflow },
    ],
  },
  {
    id: "teaching",
    title: "教学运营",
    description: "机构、教师、班级与班级统计，适合机构版和班级运营相关后台。",
    icon: GraduationCap,
    links: [
      { href: "/admin/organizations", label: "机构后台", icon: School },
      { href: "/admin/teachers", label: "教师资料", icon: Users },
      { href: "/admin/teaching-groups", label: "班级后台", icon: GraduationCap },
    ],
  },
  {
    id: "tools",
    title: "商品与工具",
    description: "商品配置、数据工具箱和低频调试页，避免和题库主流程并列。",
    icon: Package,
    links: [
      { href: "/admin/store-products", label: "商品管理", icon: ShoppingBag },
      { href: "/admin/data-kit", label: "造数据工具箱", icon: FlaskConical },
      { href: "/admin/submit-test", label: "提交测试", icon: PlayCircle },
    ],
  },
] as const

export default function AdminSecondaryPage() {
  return (
    <div className="page-wrap py-8 md:py-10">
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin Secondary"
          title="把低频后台统一收进扩展后台，不再和题库主流程并列。"
          description="这里收纳内容运营、教学运营、商品与调试工具。主后台只保留高频入口，这里负责承接低频但仍有价值的页面。"
          meta={
            <>
              <span>内容运营</span>
              <span>·</span>
              <span>教学运营</span>
              <span>·</span>
              <span>工具工作台</span>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin">返回主后台</Link>
              </Button>
            </div>
          }
        />

        <div className="grid gap-6 xl:grid-cols-3">
          {secondarySections.map((section) => {
            const Icon = section.icon
            return (
              <SectionCard
                key={section.id}
                title={section.title}
                description={section.description}
                action={<Icon className="size-5 text-muted-foreground" />}
              >
                <div id={section.id} className="grid gap-3">
                  {section.links.map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <Button
                        key={item.href}
                        asChild
                        variant="secondary"
                        className="h-auto justify-between px-4 py-4"
                      >
                        <Link href={item.href}>
                          <span className="inline-flex items-center gap-2">
                            <ItemIcon className="size-4" />
                            {item.label}
                          </span>
                          <span className="text-xs text-muted-foreground">进入</span>
                        </Link>
                      </Button>
                    )
                  })}
                </div>
              </SectionCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}
