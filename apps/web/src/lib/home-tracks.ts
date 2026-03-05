import type { LucideIcon } from "lucide-react"
import { Code2, Layers3, Sparkles, Trophy } from "lucide-react"

export type HomeTrack = {
  slug: string
  title: string
  author: string
  lessons: string
  duration: string
  learners: string
  rating: string
  tone: string
  description: string
  icon: LucideIcon
  primaryHref: string
  secondaryHref: string
}

export const HOME_TRACKS: HomeTrack[] = [
  {
    slug: "algorithm-basics",
    title: "算法基础题单",
    author: "平台官方题单",
    lessons: "48 道题",
    duration: "预计 12 小时",
    learners: "9.6K 人练过",
    rating: "4.9",
    icon: Code2,
    tone: "bg-accent",
    description: "适合刚进入 OJ 训练的新同学，覆盖数组、字符串、排序、二分等基础主题。",
    primaryHref: "/problems?difficulty=1",
    secondaryHref: "/submissions",
  },
  {
    slug: "graph-advanced",
    title: "图论进阶挑战",
    author: "竞赛训练组",
    lessons: "36 道题",
    duration: "预计 10 小时",
    learners: "7.8K 人练过",
    rating: "4.8",
    icon: Layers3,
    tone: "bg-secondary",
    description: "集中训练最短路、拓扑排序、并查集与搜索图模型，适合有一定基础的训练者。",
    primaryHref: "/problems?tagQuery=%E5%9B%BE",
    secondaryHref: "/submissions",
  },
  {
    slug: "scratch-creative",
    title: "Scratch 创意闯关",
    author: "图形化教研组",
    lessons: "52 个任务",
    duration: "预计 8 小时",
    learners: "15.3K 人练过",
    rating: "4.9",
    icon: Sparkles,
    tone: "bg-[hsl(244_41%_88%)]",
    description: "面向图形化教学场景，围绕动画、交互与小游戏任务，结合自动评测给出反馈。",
    primaryHref: "/problems?tags=scratch-%E5%BF%85%E5%81%9A%2Cscratch-%E5%8F%AF%E9%80%89",
    secondaryHref: "/graphical",
  },
  {
    slug: "weekly-warmup",
    title: "周赛热身专区",
    author: "周赛题库维护组",
    lessons: "42 道题",
    duration: "预计 6 小时",
    learners: "11.2K 人练过",
    rating: "4.7",
    icon: Trophy,
    tone: "bg-primary/60",
    description: "按周赛节奏组织中等与困难题，建议配合计时训练和提交复盘一起使用。",
    primaryHref: "/problems?difficulty=2",
    secondaryHref: "/submissions",
  },
]

export function getTrackBySlug(slug: string) {
  return HOME_TRACKS.find((track) => track.slug === slug) ?? null
}
