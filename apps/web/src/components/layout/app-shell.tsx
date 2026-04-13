"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react"
import { Footer } from "@/components/layout/footer"
import { cn } from "@/lib/utils"

type AppShellProps = {
  children: React.ReactNode
}

const shellLinks = [
  { href: "/", label: "训练首页", icon: LayoutDashboard },
  { href: "/problems", label: "题库练习", icon: BookOpen },
  { href: "/submissions", label: "提交记录", icon: ClipboardList },
  { href: "/learn", label: "视频学习", icon: GraduationCap },
  { href: "/admin", label: "后台入口", icon: ShieldCheck },
]

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isProblemDetail =
    pathname?.startsWith("/problems/") &&
    pathname.split("/").filter(Boolean).length === 2
  const isGraphical = pathname?.startsWith("/graphical")
  const shellDisabled = isGraphical
  const shellBackdropClass = isProblemDetail
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_24%)]"
    : "pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_30%)]"

  React.useEffect(() => {
    if (!isProblemDetail) return

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow

    window.scrollTo(0, 0)
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
    }
  }, [isProblemDetail])

  if (shellDisabled) {
    return (
      <>
        <main className="relative min-h-0 flex-1">
          <div className="relative">{children}</div>
        </main>
      </>
    )
  }

  const rail = (
    <aside
      className={cn(
        "ui-shell-rail hidden xl:block",
        isProblemDetail
          ? "fixed left-0 top-24 z-40 w-[4.75rem] overflow-visible"
          : "top-7",
      )}
    >
      <div className={cn("space-y-4", isProblemDetail && "space-y-0")}>
        <div
          className={cn(
            "ui-shell-block p-4",
            isProblemDetail &&
              "group/rail w-[4.75rem] overflow-hidden rounded-r-[1.75rem] rounded-l-none border-l-0 p-3 transition-[width,box-shadow] duration-200 ease-out hover:w-[15.5rem] focus-within:w-[15.5rem]",
          )}
        >
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
              isProblemDetail &&
                "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-150 group-hover/rail:max-w-[12rem] group-hover/rail:opacity-100 group-focus-within/rail:max-w-[12rem] group-focus-within/rail:opacity-100",
            )}
          >
            Workspace
          </p>
          <div className={cn("mt-4 space-y-2", isProblemDetail && "mt-0")}>
            {shellLinks.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "ui-shell-link focus-ring",
                    isProblemDetail &&
                      "justify-center rounded-[1.1rem] px-2 py-3 transition-[padding,justify-content] duration-200 group-hover/rail:justify-start group-hover/rail:px-3 group-focus-within/rail:justify-start group-focus-within/rail:px-3",
                  )}
                  data-active={active}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-white",
                      active ? "bg-primary/40" : "bg-white",
                      isProblemDetail && "size-10",
                    )}
                  >
                    <Icon className="size-4 text-foreground" />
                  </span>
                  <span
                    className={cn(
                      isProblemDetail
                        ? "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-150 group-hover/rail:ml-0.5 group-hover/rail:max-w-[10rem] group-hover/rail:opacity-100 group-focus-within/rail:ml-0.5 group-focus-within/rail:max-w-[10rem] group-focus-within/rail:opacity-100"
                        : "",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {!isProblemDetail ? (
          <>
            <div className="ui-shell-block p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                今日节奏
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-[1.2rem] border-[2px] border-border bg-white px-3.5 py-3">
                  <p className="text-sm font-semibold text-foreground">先选一件事</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    刷题、补课或复盘，首页和题库都已经前置这三个入口。
                  </p>
                </div>
                <div className="rounded-[1.2rem] border-[2px] border-border bg-white px-3.5 py-3">
                  <p className="text-sm font-semibold text-foreground">结果要能回看</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    提交页、学习中心和后台都用统一结构组织信息。
                  </p>
                </div>
              </div>
            </div>

            <div className="ui-shell-block p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border-2 border-border bg-secondary">
                  <BarChart3 className="size-4 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">训练工作区</p>
                  <p className="text-xs text-muted-foreground">统一左侧导航与主内容区</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  )

  if (isProblemDetail) {
    return (
      <>
        <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden">
          <div className={shellBackdropClass} />
          {rail}
          <div className="relative h-full w-full px-3 pb-3 pt-2 xl:pl-[5.75rem] xl:pr-4">
            <div className="ui-shell-main h-full">{children}</div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <main className="relative min-h-0 flex-1">
        <div className={shellBackdropClass} />
        <div className="relative ui-shell-grid">
          {rail}
          <div className="ui-shell-main">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  )
}
