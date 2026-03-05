import type { LucideIcon } from "lucide-react"
import { Clock3, Layers3, MonitorPlay, Users } from "lucide-react"

export type HomeFeature = {
  slug: string
  title: string
  description: string
  tone: string
  icon: LucideIcon
  highlights: string[]
  primaryHref: string
  secondaryHref: string
}

export const HOME_FEATURES: HomeFeature[] = [
  {
    slug: "paced-training",
    title: "按自己的节奏刷题",
    description: "从入门到进阶按专题推进，支持随时暂停和继续训练。",
    tone: "bg-accent",
    icon: Clock3,
    highlights: [
      "专题化训练路径，减少选题成本",
      "可在题库和专题间无缝切换",
      "适合长期分阶段练习",
    ],
    primaryHref: "/tracks",
    secondaryHref: "/problems",
  },
  {
    slug: "multi-language-judge",
    title: "多语言提交与评测",
    description: "C++、Python 与 Scratch 统一提交流程，结果反馈一致。",
    tone: "bg-secondary",
    icon: MonitorPlay,
    highlights: [
      "代码题与 Scratch 题共享账号体系",
      "提交状态与结果视图统一呈现",
      "支持按题和按用户查看提交记录",
    ],
    primaryHref: "/submissions",
    secondaryHref: "/problems",
  },
  {
    slug: "dual-track-learning",
    title: "图形化与代码双轨训练",
    description: "算法题和图形化任务共用账号与进度，学习路径更连贯。",
    tone: "bg-[hsl(244_41%_88%)]",
    icon: Layers3,
    highlights: [
      "图形化入口与代码题入口并行",
      "训练内容可按主题分批推进",
      "适配课堂和自学两种场景",
    ],
    primaryHref: "/graphical",
    secondaryHref: "/tracks/scratch-creative",
  },
  {
    slug: "admin-collaboration",
    title: "后台批量协作",
    description: "支持题库、测试点、标签与导入导出的批量管理操作。",
    tone: "bg-primary/60",
    icon: Users,
    highlights: [
      "题库与专题统一管理入口",
      "批量导入导出与变更记录",
      "适合教研团队协同维护",
    ],
    primaryHref: "/admin",
    secondaryHref: "/admin/problems",
  },
]

export function getFeatureBySlug(slug: string) {
  return HOME_FEATURES.find((feature) => feature.slug === slug) ?? null
}
