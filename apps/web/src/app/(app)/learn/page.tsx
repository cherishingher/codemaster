import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Eye,
  GraduationCap,
  Lock,
  MonitorPlay,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { SectionHeading } from "@/components/patterns/section-heading";
import { EmptyState } from "@/components/patterns/state-panel";
import { UpgradePlanButton } from "@/components/learn/upgrade-plan-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLearnLibraryData, groupCoursesByCategory } from "@/lib/learn";

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
  }).format(priceCents / 100);
}

function formatDuration(totalSec: number) {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.round((totalSec % 3600) / 60);
  if (hours <= 0) return `${minutes} 分钟`;
  return `${hours} 小时 ${minutes} 分钟`;
}

function getPlanMeta(plan: "guest" | "free" | "paid") {
  switch (plan) {
    case "paid":
      return {
        label: "VIP 会员",
        description: "可观看全部会员课程、完整章节和进阶训练视频。",
        badgeClass: "bg-primary/20",
      };
    case "free":
      return {
        label: "免费版",
        description: "可浏览课程库，观看试听视频，付费课程保持锁定状态。",
        badgeClass: "bg-secondary/70",
      };
    default:
      return {
        label: "访客模式",
        description: "可查看课程结构，登录后可保存学习状态并开通 VIP。",
        badgeClass: "bg-accent/70",
      };
  }
}

const planFeatures = {
  free: ["浏览全部课程目录", "试看公开视频", "查看课程分类与简介"],
  paid: ["观看全部教学视频", "解锁会员章节", "查看更多 VIP 专属内容"],
};

export default async function LearnPage() {
  const { viewer, product, courses } = await getLearnLibraryData();
  const groups = groupCoursesByCategory(courses);
  const planMeta = getPlanMeta(viewer.plan);

  return (
    <div className="page-wrap py-10 md:py-14">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="bg-background">
          <CardContent className="space-y-7 p-7 md:p-10">
            <div className="inline-flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
              <MonitorPlay className="size-4" />
              视频学习中心
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                在主站内直接接入
                <span className="text-primary"> 分类课程、视频学习与会员权限</span>
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                课程按分类展示，免费版可以试看公开视频，VIP 会员解锁全部章节。后续只需要继续往数据库写课程、
                分节和视频地址，就能直接在这里展示。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">已发布课程</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{courses.length}</p>
              </div>
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">分类数量</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{groups.length}</p>
              </div>
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm text-muted-foreground">试看内容</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {courses.reduce((sum, course) => sum + course.previewCount, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-background">
          <CardContent className="space-y-6 p-7 md:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account Plan</p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">当前权限</h2>
              </div>
              <Badge className={planMeta.badgeClass}>{planMeta.label}</Badge>
            </div>

            <p className="text-sm leading-7 text-muted-foreground">{planMeta.description}</p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm font-semibold text-foreground">免费版</p>
                <div className="mt-3 space-y-2">
                  {planFeatures.free.map((item) => (
                    <p key={item} className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                      <Eye className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
                <p className="text-sm font-semibold text-foreground">VIP 会员</p>
                <div className="mt-3 space-y-2">
                  {planFeatures.paid.map((item) => (
                    <p key={item} className="inline-flex items-start gap-2 text-sm text-muted-foreground">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border-[3px] border-border bg-[linear-gradient(135deg,rgba(103,197,89,0.14),rgba(245,184,167,0.16))] px-5 py-5">
              <p className="text-sm font-semibold text-foreground">{product.name}</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold text-foreground">{formatPrice(product.priceCents)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.validDays ? `有效期 ${product.validDays} 天` : "长期有效"} · 本地开发环境走模拟支付
                  </p>
                </div>
                <UpgradePlanButton plan={viewer.plan} size="lg" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Learning Library"
          title="按分类查看学习视频"
          description="所有课程都来自数据库。免费版能看试听内容，VIP 会员可以打开完整课程。"
        />

        {groups.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="还没有课程数据"
              description="课程表已经接入完成，但当前数据库中还没有已发布的视频课程。"
            />
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {groups.map((group) => (
              <section key={group.category} className="space-y-5">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{group.category}</Badge>
                  <p className="text-sm text-muted-foreground">{group.items.length} 门课程</p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  {group.items.map((course, index) => (
                    <Card key={course.id} className="overflow-hidden bg-background">
                      <div
                        className="border-b-[3px] border-border px-6 py-6"
                        style={{
                          background:
                            index % 2 === 0
                              ? "linear-gradient(135deg, rgba(103,197,89,0.18), rgba(141,194,245,0.18))"
                              : "linear-gradient(135deg, rgba(245,184,167,0.2), rgba(255,241,161,0.18))",
                        }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                              <GraduationCap className="size-3.5" />
                              {course.previewCount > 0 ? "含试听" : "仅会员"}
                            </div>
                            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{course.title}</h3>
                            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                              {course.summary || course.description || "课程简介待补充"}
                            </p>
                          </div>
                          <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-3 text-right">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">试看</p>
                            <p className="text-2xl font-semibold text-foreground">{course.previewCount}</p>
                          </div>
                        </div>
                      </div>

                      <CardContent className="space-y-5 p-6">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">章节</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{course.sectionCount}</p>
                          </div>
                          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">视频</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{course.lessonCount}</p>
                          </div>
                          <div className="rounded-[1.4rem] border-[2px] border-border bg-card px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">时长</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">
                              {formatDuration(course.totalDurationSec)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button asChild>
                            <Link href={`/learn/${course.slug}`}>
                              进入课程
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                          {course.paidLessonCount > 0 ? (
                            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                              <Lock className="size-4 text-primary" />
                              会员内容 {course.paidLessonCount} 节
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                              <PlayCircle className="size-4 text-primary" />
                              全部内容可试看
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <Card className="bg-background">
          <CardContent className="flex flex-col gap-5 p-7 md:flex-row md:items-center md:justify-between md:p-10">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Next Step</p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">后续只要继续上传课程数据即可</h2>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                当前结构已经支持课程分类、章节、视频地址和试看权限。后面接入真实上传后台时，不需要再重做前台展示层。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href="/profile">
                  查看账号
                  <BookOpen className="size-4" />
                </Link>
              </Button>
              <UpgradePlanButton plan={viewer.plan} />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
