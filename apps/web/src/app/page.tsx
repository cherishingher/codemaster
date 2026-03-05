import Link from "next/link";
import { ArrowRight, BookOpen, Check, Clock3, MonitorPlay, Star, Users } from "lucide-react";
import { SectionHeading } from "@/components/patterns/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HOME_TRACKS } from "@/lib/home-tracks";
import { HOME_FEATURES } from "@/lib/home-features";

const stats = [
  { value: "1000+", label: "已入库题目" },
  { value: "30万+", label: "累计提交" },
  { value: "500+", label: "图形化任务" },
];

const testimonials = [
  {
    quote:
      "题库筛选、提交反馈和进度看板放在一起后，我每天训练的启动成本低了很多。",
    name: "陈思远",
    role: "算法入门学员",
    initial: "C",
    tone: "bg-accent",
  },
  {
    quote:
      "Scratch 任务和代码题共用同一套账号体系，课堂切换练习模式非常顺手。",
    name: "李安娜",
    role: "信息学教师",
    initial: "L",
    tone: "bg-secondary",
  },
  {
    quote:
      "后台批量导入题目和测试点后，教研维护效率明显提升，迭代也更可控。",
    name: "周凯文",
    role: "教研管理员",
    initial: "Z",
    tone: "bg-[hsl(244_41%_88%)]",
  },
];

export default function Home() {
  return (
    <div className="pb-20">
      <section className="page-wrap py-10 md:py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
              <span className="size-3 rounded-full bg-primary-foreground/80" />
              新增：题库 + 图形化统一训练看板
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
                <span className="text-primary">随时随地</span>完成刷题、
                提交评测与图形化挑战。
              </h1>
              <p className="max-w-2xl text-lg leading-9 text-muted-foreground">
                把题库、提交、Scratch 工作区与后台管理组织成一套统一界面。当前版本只扩展首页前端模块，
                不改任何后端逻辑和数据链路。
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="min-w-[16rem] justify-center">
                <Link href="/problems">
                  立即开始刷题
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="min-w-[13rem] justify-center">
                <Link href="/register">注册账号</Link>
              </Button>
            </div>

            <div className="grid max-w-xl grid-cols-3 gap-5">
              {stats.map((item) => (
                <div key={item.label} className="space-y-1">
                  <p className="text-4xl font-semibold tracking-tight text-foreground">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <Card className="overflow-hidden rounded-[2.3rem] bg-background">
              <CardContent className="space-y-7 p-7 md:p-9">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-18 items-center justify-center rounded-[1.5rem] bg-secondary">
                      <MonitorPlay className="size-8 text-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold text-foreground">洛谷入门题单</h2>
                      <p className="text-base text-muted-foreground">12 道题 · 已完成 8 题</p>
                    </div>
                  </div>
                  <div className="rounded-[1.7rem] bg-accent px-5 py-4 text-3xl">🎯</div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    <span>当前进度</span>
                    <span className="text-2xl font-semibold text-primary">65%</span>
                  </div>
                  <div className="h-4 rounded-full border-[3px] border-border bg-card p-0.5">
                    <div className="h-full w-[65%] rounded-full bg-primary" />
                  </div>
                </div>

                <Button asChild size="lg" className="w-full justify-center">
                  <Link href="/tracks/algorithm-basics">继续刷题</Link>
                </Button>
              </CardContent>
            </Card>

            <div className="absolute -left-4 bottom-10 flex size-20 items-center justify-center rounded-[1.7rem] bg-[hsl(244_41%_88%)] text-3xl shadow-[8px_8px_0_hsl(var(--border))]">
              📚
            </div>
            <div className="absolute -right-5 top-16 flex size-22 items-center justify-center rounded-[1.7rem] bg-accent text-3xl shadow-[8px_8px_0_hsl(var(--border))]">
              🧠
            </div>
            <div className="absolute -right-8 bottom-20 flex size-18 items-center justify-center rounded-full bg-primary/70 text-3xl shadow-[8px_8px_0_hsl(var(--border))]">
              ⭐
            </div>
          </div>
        </div>
      </section>

      <section className="page-wrap py-14 md:py-18">
        <SectionHeading
          eyebrow="热门专题"
          title="探索热门刷题专题"
          description="按题型和难度整理的训练专题，直接进入提交与评测流程。"
          align="center"
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {HOME_TRACKS.map((course) => {
            const Icon = course.icon;
            return (
              <Card key={course.slug} className="bg-background transition-transform hover:-translate-y-0.5">
                <CardContent className="p-6 md:p-8">
                  <Link href={`/tracks/${course.slug}`} className="flex items-start justify-between gap-4">
                    <div className="flex gap-5">
                      <div className={`flex size-18 items-center justify-center rounded-[1.5rem] ${course.tone}`}>
                        <Icon className="size-8 text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold tracking-tight text-foreground">{course.title}</h3>
                        <p className="text-base text-muted-foreground">维护：{course.author}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <BookOpen className="size-4" />
                            {course.lessons}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Clock3 className="size-4" />
                            {course.duration}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <Users className="size-4" />
                            {course.learners}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-primary/90 px-4 py-2 text-base font-semibold text-primary">
                      <Star className="size-4 fill-current" />
                      {course.rating}
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <Button asChild variant="secondary" size="lg" className="min-w-[16rem] justify-center">
            <Link href="/tracks">
              查看所有专题
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="py-14 md:py-18">
        <div className="page-wrap rounded-[3rem] bg-card/65 px-6 py-10 md:px-8 md:py-14">
          <SectionHeading
            eyebrow="为什么选择 CodeMaster"
            title="高效训练所需的一切"
            description="面向 OJ 练习场景设计，兼顾高密度信息与持续学习体验。"
            align="center"
          />

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {HOME_FEATURES.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Link
                  key={benefit.slug}
                  href={`/features/${benefit.slug}`}
                  className="rounded-[2rem] bg-background/85 px-7 py-8 text-center shadow-[0_16px_36px_rgba(31,41,55,0.08)]"
                >
                  <div className={`mx-auto mb-6 flex size-18 items-center justify-center rounded-[1.5rem] ${benefit.tone}`}>
                    <Icon className="size-8 text-foreground" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground">{benefit.title}</h3>
                  <p className="mt-4 text-base leading-8 text-muted-foreground">{benefit.description}</p>
                  <p className="mt-4 text-sm font-medium text-primary">查看详情</p>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 flex justify-center">
            <Button asChild variant="secondary">
              <Link href="/features">
                查看全部能力模块
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="page-wrap py-14 md:py-18">
        <SectionHeading
          eyebrow="使用反馈"
          title="他们怎么评价这套训练流"
          description="以下是首页静态示例文案，用来演示用户评价模块的结构与层级。"
          align="center"
        />

        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {testimonials.map((item) => (
            <Card key={item.name} className="bg-background">
              <CardContent className="space-y-6 p-7">
                <div className="flex gap-2 text-[hsl(48_86%_56%)]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={`${item.name}-${index}`} className="size-6 fill-current" />
                  ))}
                </div>
                <p className="text-lg leading-9 text-muted-foreground">“{item.quote}”</p>
                <div className="flex items-center gap-4">
                  <div className={`flex size-16 items-center justify-center rounded-[1.3rem] text-3xl font-semibold text-foreground ${item.tone}`}>
                    {item.initial}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">{item.name}</p>
                    <p className="text-base text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-secondary/70 py-16 md:py-20">
        <div className="page-wrap">
          <Card className="mx-auto max-w-5xl bg-background">
            <CardContent className="px-7 py-10 text-center md:px-12 md:py-14">
              <div className="space-y-5">
                <h2 className="text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                  准备好开始练题了吗？
                </h2>
                <p className="mx-auto max-w-3xl text-lg leading-9 text-muted-foreground">
                  从公开题库出发，逐步衔接专题训练、图形化任务和提交分析。先完成账号注册，再开始你的第一轮训练。
                </p>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="min-w-[16rem] justify-center">
                  <Link href="/problems">
                    立即开始刷题
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg" className="min-w-[13rem] justify-center">
                  <Link href="/register">注册账号</Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-8 text-base text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Check className="size-5 text-primary" />
                  代码题与 Scratch 同站训练
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="size-5 text-primary" />
                  提交、进度、后台管理一体化
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
