import * as React from "react";
import { Code2, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  asideTitle?: string;
  asideDescription?: string;
};

const featureItems = [
  {
    icon: ShieldCheck,
    title: "统一认证入口",
    description: "邮箱和手机号共用同一套账号体系，界面只负责呈现，鉴权逻辑保持不变。",
  },
  {
    icon: Workflow,
    title: "验证码闭环",
    description: "注册、登录补充流程和找回密码共用一套验证码交互规范。",
  },
  {
    icon: Sparkles,
    title: "高密度表单",
    description: "更紧凑的间距、清晰的帮助信息和更可控的 focus 样式。",
  },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  asideTitle = "认证系统",
  asideDescription = "新的 UI 批次先统一登录、注册和找回密码体验，后续页面迁移会继续沿用同一套 tokens 与交互规范。",
}: AuthShellProps) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl gap-6 px-4 py-6 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[2.4rem] border-[4px] border-border bg-card p-6 shadow-[14px_14px_0_hsl(var(--border))] md:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,184,167,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(103,197,89,0.24),transparent_34%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border-[3px] border-border bg-background px-4 py-2 shadow-[6px_6px_0_hsl(var(--border))]">
              <div className="flex size-11 items-center justify-center rounded-[1.2rem] bg-accent text-foreground">
                <Code2 className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  CodeMaster
                </p>
                <p className="text-sm font-medium text-foreground">{asideTitle}</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="ui-eyebrow">{eyebrow}</p>
              <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                {description}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {featureItems.map(({ icon: Icon, title: itemTitle, description: itemDescription }) => (
              <Card
                key={itemTitle}
                className={cn(
                  "bg-background p-4 shadow-[8px_8px_0_hsl(var(--border))]",
                )}
              >
                <div className="space-y-3">
                  <div className="flex size-11 items-center justify-center rounded-[1rem] border-2 border-border bg-secondary text-foreground">
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-sm font-semibold text-foreground">{itemTitle}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">{itemDescription}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="relative z-10 max-w-2xl text-sm leading-6 text-muted-foreground">
            {asideDescription}
          </p>
        </div>
      </section>

      <section className="flex items-center">
        <div className="w-full">{children}</div>
      </section>
    </div>
  );
}
