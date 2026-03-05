import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Lock,
  Loader2,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StatePanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "default" | "warning" | "danger";
  action?: React.ReactNode;
  className?: string;
};

const toneStyles: Record<NonNullable<StatePanelProps["tone"]>, string> = {
  default: "border-primary/12 bg-card/90 text-primary",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-destructive/15 bg-destructive/5 text-destructive",
};

export function StatePanel({
  icon: Icon,
  title,
  description,
  tone = "default",
  action,
  className,
}: StatePanelProps) {
  return (
    <Card className={cn("mx-auto max-w-xl", className)}>
      <CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl border shadow-sm",
            toneStyles[tone],
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function LoadingState({
  title = "正在加载页面",
  description = "正在准备界面与数据，请稍候。",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <StatePanel
      icon={Loader2}
      title={title}
      description={description}
      className={className}
      action={<Loader2 className="size-4 animate-spin text-primary" />}
    />
  );
}

export function EmptyState({
  title = "暂无内容",
  description = "当前筛选条件下还没有可展示的数据。",
  href,
  actionLabel = "返回题库",
  className,
}: {
  title?: string;
  description?: string;
  href?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <StatePanel
      icon={SearchX}
      title={title}
      description={description}
      className={className}
      action={
        href ? (
          <Button asChild variant="outline">
            <Link href={href}>{actionLabel}</Link>
          </Button>
        ) : null
      }
    />
  );
}

export function ErrorState({
  title = "加载失败",
  description = "页面发生错误，请刷新重试；如果问题持续存在，再检查后端接口状态。",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StatePanel
      icon={AlertTriangle}
      title={title}
      description={description}
      tone="danger"
      action={action}
      className={className}
    />
  );
}

export function UnauthorizedState({
  title = "需要登录",
  description = "当前内容需要登录后访问，请先完成登录再继续。",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <StatePanel
      icon={Lock}
      title={title}
      description={description}
      tone="warning"
      className={className}
      action={
        <Button asChild>
          <Link href="/login">前往登录</Link>
        </Button>
      }
    />
  );
}
