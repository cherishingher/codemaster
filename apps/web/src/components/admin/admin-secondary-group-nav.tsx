"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { cn } from "@/lib/utils"

type SecondaryGroup = "content" | "teaching" | "tools"

const secondaryGroupMeta: Record<
  SecondaryGroup,
  {
    title: string
    description: string
    links: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>
  }
> = {
  content: {
    title: "内容运营",
    description: "题解、视频、训练路径与审核流转统一归组，不再散落在主后台。",
    links: [
      { href: "/admin/content", label: "内容后台", icon: LayoutPanelTop },
      { href: "/admin/content/solutions", label: "题解", icon: PlayCircle },
      { href: "/admin/content/videos", label: "视频", icon: Video },
      { href: "/admin/content/paths", label: "路径", icon: Route },
      { href: "/admin/content/workflow", label: "审核日志", icon: Workflow },
    ],
  },
  teaching: {
    title: "教学运营",
    description: "机构、教师与班级统一归组，避免和 OJ 主后台混在一起。",
    links: [
      { href: "/admin/organizations", label: "机构", icon: School },
      { href: "/admin/teachers", label: "教师", icon: Users },
      { href: "/admin/teaching-groups", label: "班级", icon: GraduationCap },
    ],
  },
  tools: {
    title: "商品与工具",
    description: "商品配置、数据工具箱和调试页统一收口到扩展后台。",
    links: [
      { href: "/admin/store-products", label: "商品", icon: ShoppingBag },
      { href: "/admin/data-kit", label: "造数据", icon: FlaskConical },
      { href: "/admin/submit-test", label: "提交测试", icon: Package },
    ],
  },
}

export function AdminSecondaryGroupNav({ group }: { group: SecondaryGroup }) {
  const pathname = usePathname()
  const meta = secondaryGroupMeta[group]

  return (
    <div className="rounded-[1.4rem] border-[2px] border-border bg-card/90 p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            扩展后台 / {meta.title}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{meta.description}</div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/admin/secondary#${group}`}>返回扩展后台</Link>
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {meta.links.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)

          return (
            <Button
              key={item.href}
              asChild
              size="sm"
              variant={active ? "default" : "secondary"}
              className={cn("justify-start", active && "pointer-events-none")}
            >
              <Link href={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
