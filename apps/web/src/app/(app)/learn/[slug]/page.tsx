import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Eye,
  Lock,
  PlayCircle,
} from "lucide-react";
import { AccessLockCard } from "@/components/content-access/access-lock-card";
import { UpgradePlanButton } from "@/components/learn/upgrade-plan-button";
import { EmptyState } from "@/components/patterns/state-panel";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLearnCourseDetail } from "@/lib/learn";
import { cn } from "@/lib/utils";

type LearnCourseDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lesson?: string | string[] | undefined }>;
};

function formatDuration(durationSec: number | null) {
  if (!durationSec || durationSec <= 0) return "时长待补充";
  const minutes = Math.max(Math.round(durationSec / 60), 1);
  return `${minutes} 分钟`;
}

function getPlanBadge(plan: "guest" | "free" | "paid") {
  if (plan === "paid") return { label: "VIP 会员", className: "bg-primary/20" };
  if (plan === "free") return { label: "免费版", className: "bg-secondary/70" };
  return { label: "访客", className: "bg-accent/70" };
}

export default async function LearnCourseDetailPage({
  params,
  searchParams,
}: LearnCourseDetailPageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({ lesson: undefined }),
  ]);

  const lessonSlug = typeof resolvedSearchParams.lesson === "string" ? resolvedSearchParams.lesson : null;
  const { viewer, course } = await getLearnCourseDetail(slug, lessonSlug);

  if (!course) {
    notFound();
  }

  const planBadge = getPlanBadge(viewer.plan);
  const lesson = course.selectedLesson;

  if (course.lessonCount > 0 && !lesson) {
    notFound();
  }

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="space-y-5">
        <Breadcrumbs
          items={[
            { label: "视频学习", href: "/learn" },
            { label: course.title },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button asChild variant="secondary" size="sm">
            <Link href="/learn">
              <ArrowLeft className="size-4" />
              返回课程库
            </Link>
          </Button>
          <Badge className={planBadge.className}>{planBadge.label}</Badge>
        </div>
      </div>

      <Card className="mt-6 bg-background">
        <CardContent className="space-y-6 p-7 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {course.category || "视频学习"}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{course.title}</h1>
              <p className="max-w-4xl text-sm leading-7 text-muted-foreground">
                {course.description || course.summary || "课程简介待补充"}
              </p>
            </div>
            <div className="grid min-w-[15rem] gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">章节</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{course.sectionCount}</p>
              </div>
              <div className="rounded-[1.4rem] border-[3px] border-border bg-card px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">视频</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{course.lessonCount}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2">
              <Eye className="size-4 text-primary" />
              可试看 {course.previewCount} 节
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2">
              <Lock className="size-4 text-primary" />
              会员内容 {course.paidLessonCount} 节
            </span>
          </div>
        </CardContent>
      </Card>

      {course.lessonCount === 0 ? (
        <div className="mt-8">
          <EmptyState title="课程里还没有视频" description="课程结构已创建，但当前还没有实际的视频章节。" />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-6">
            <Card className="overflow-hidden bg-background">
              <div className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(141,194,245,0.2),rgba(103,197,89,0.14))] px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">当前视频</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {lesson?.title || "请选择章节"}
                    </h2>
                  </div>
                  {lesson ? (
                    lesson.isPreview ? (
                      <Badge variant="secondary">试看内容</Badge>
                    ) : (
                      <Badge>会员内容</Badge>
                    )
                  ) : null}
                </div>
              </div>

              <CardContent className="space-y-6 p-6">
                {lesson && lesson.canWatch ? (
                  <div className="space-y-5">
                    <div className="overflow-hidden rounded-[1.8rem] border-[3px] border-border bg-slate-950">
                      {lesson.assetUri ? (
                        <video
                          key={lesson.slug}
                          className="aspect-video w-full bg-black"
                          controls
                          preload="metadata"
                          poster={lesson.thumbnailUrl || undefined}
                          src={lesson.assetUri}
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_42%)] px-6 text-center">
                          <div className="space-y-3">
                            <PlayCircle className="mx-auto size-12 text-white/90" />
                            <p className="text-base font-semibold text-white">视频地址待上传</p>
                            <p className="text-sm text-white/70">课程结构已经就绪，后续只要补充视频地址即可直接播放。</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2">
                        <Clock3 className="size-4 text-primary" />
                        {formatDuration(lesson.durationSec)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border-[2px] border-border bg-card px-4 py-2">
                        <BookOpen className="size-4 text-primary" />
                        {lesson.type}
                      </span>
                    </div>

                    <div className="space-y-4 rounded-[1.8rem] border-[3px] border-border bg-card px-5 py-5">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">课程说明</h3>
                        <p className="text-sm leading-7 text-muted-foreground">
                          {lesson.summary || "本节简介待补充"}
                        </p>
                      </div>
                      {lesson.content ? (
                        <div className="rounded-[1.4rem] border-[2px] border-border bg-white/75 px-4 py-4">
                          <p className="whitespace-pre-line text-sm leading-7 text-foreground">{lesson.content}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : lesson ? (
                  <AccessLockCard
                    access={lesson.access}
                    title="这节视频还没有解锁"
                    description="视频播放与完整讲解已经被后端权限中心拦截，当前只展示章节信息和最小摘要。"
                    preview={
                      lesson.summary ? (
                        <p className="text-sm leading-7 text-muted-foreground">{lesson.summary}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">当前章节没有可公开展示的摘要内容。</p>
                      )
                    }
                  />
                ) : null}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card className="bg-background">
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">章节目录</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">选择学习内容</h2>
                </div>

                <div className="space-y-4">
                  {course.sections.map((section, sectionIndex) => (
                    <div
                      key={section.id}
                      className="rounded-[1.6rem] border-[3px] border-border bg-card px-4 py-4"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                          Section {sectionIndex + 1}
                        </p>
                        <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                        {section.description ? (
                          <p className="text-sm leading-6 text-muted-foreground">{section.description}</p>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        {section.lessons.map((item) => {
                          const active = item.slug === lesson?.slug;
                          return (
                            <Link
                              key={item.id}
                              href={`/learn/${course.slug}?lesson=${item.slug}`}
                              className={cn(
                                "block rounded-[1.3rem] border-[2px] px-4 py-3 transition-all",
                                active
                                  ? "border-border bg-primary text-primary-foreground shadow-[6px_6px_0_hsl(var(--border))]"
                                  : "border-border bg-white/80 hover:-translate-y-0.5 hover:bg-secondary/35",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className={cn("text-sm font-semibold", active ? "text-primary-foreground" : "text-foreground")}>
                                    {item.title}
                                  </p>
                                  <p
                                    className={cn(
                                      "text-xs",
                                      active ? "text-primary-foreground/85" : "text-muted-foreground",
                                    )}
                                  >
                                    {formatDuration(item.durationSec)}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                                    active
                                      ? "border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground"
                                      : "border-border bg-card text-foreground",
                                  )}
                                >
                                  {item.isPreview ? (
                                    <>
                                      <Eye className="size-3.5" />
                                      试看
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="size-3.5" />
                                      会员
                                    </>
                                  )}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">权限说明</h2>
                <div className="space-y-3 text-sm leading-7 text-muted-foreground">
                  <p>免费版：可浏览课程目录、进入详情页、观看标记为“试看”的视频。</p>
                  <p>VIP 会员：可观看全部视频课程，后续也可以扩展更多会员专属专栏。</p>
                </div>
                <UpgradePlanButton plan={viewer.plan} className="w-full" />
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
