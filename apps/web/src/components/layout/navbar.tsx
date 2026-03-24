"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { useMembership } from "@/lib/hooks/use-membership"
import { MembershipBadge } from "@/components/membership/membership-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Baby,
  BarChart3,
  BrainCircuit,
  Code2,
  Crown,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  User,
} from "lucide-react"

const navItems = [
  { href: "/problems", label: "题库" },
  { href: "/contests", label: "比赛" },
  { href: "/learn", label: "视频学习" },
  { href: "/discuss", label: "社区" },
  { href: "/submissions", label: "提交" },
]

export function Navbar() {
  const { user, loggedIn, logout } = useAuth()
  const { membership } = useMembership(loggedIn)
  const pathname = usePathname()
  const isAdmin = user?.role === "admin" || user?.roles?.includes("admin")
  const canAccessTenant = isAdmin || user?.roles?.includes("teacher") || user?.roles?.includes("org_admin")
  const canAccessParent = isAdmin || user?.roles?.includes("parent")
  const isProblemWorkspace =
    pathname?.startsWith("/problems/") &&
    pathname.split("/").filter(Boolean).length === 2

  if (isProblemWorkspace) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/10 bg-background/88 px-3 py-3 backdrop-blur-xl md:px-4">
      <div className="mx-auto w-full max-w-[var(--page-max)]">
        <div
          className={cn(
            "surface-panel overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,244,252,0.92),rgba(248,236,231,0.88))]",
            isProblemWorkspace ? "shadow-[var(--shadow-md)]" : "shadow-[var(--shadow-xl)]",
          )}
        >
          <div className="flex flex-col gap-4 px-4 py-4 md:px-5 lg:px-6">
            <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
              <Link href="/" className="focus-ring flex min-w-0 items-center gap-3 rounded-[1.4rem] pr-2">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-[1.25rem] border-[3px] border-border bg-accent",
                    isProblemWorkspace ? "size-12" : "size-14",
                  )}
                >
                  <Code2 className="size-5 text-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        "truncate font-semibold tracking-tight text-foreground",
                        isProblemWorkspace ? "text-xl" : "text-2xl",
                      )}
                    >
                      CodeMaster
                    </p>
                    <Badge variant="outline" className="hidden md:inline-flex">
                      Practice Workspace
                    </Badge>
                  </div>
                  <p className="truncate text-xs font-medium tracking-[0.16em] text-muted-foreground">
                    算法训练、课程学习、提交复盘与后台协作统一工作区
                  </p>
                </div>
              </Link>

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {loggedIn ? (
                  <>
                    <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                      <Link href="/dashboard">
                        <LayoutDashboard className="size-4" />
                        看板
                      </Link>
                    </Button>
                    {membership ? (
                      <Link href="/membership" className="hidden lg:block">
                        <MembershipBadge status={membership.status} compact />
                      </Link>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="relative h-12 gap-3 rounded-[1.4rem] pl-2.5 pr-4">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.avatar ?? undefined} alt={user?.name || "User"} />
                            <AvatarFallback>{user?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="hidden text-left md:block">
                            <p className="max-w-36 truncate text-sm font-semibold text-foreground">
                              {user?.name || "User"}
                            </p>
                            <p className="max-w-36 truncate text-xs text-muted-foreground">
                              {membership ? "会员与学习入口" : "个人中心与学习记录"}
                            </p>
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-60" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-2">
                            <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                              {user?.email ?? user?.phone}
                            </p>
                            {membership ? (
                              <MembershipBadge status={membership.status} compact className="w-fit" />
                            ) : null}
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          学习中心
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href="/profile">
                            <User className="mr-2 h-4 w-4" />
                            <span>个人中心</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>训练看板</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/reports/learning">
                            <BarChart3 className="mr-2 h-4 w-4" />
                            <span>学习报告</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/submissions">
                            <Code2 className="mr-2 h-4 w-4" />
                            <span>我的提交</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          交易与权益
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href="/membership">
                            <Crown className="mr-2 h-4 w-4" />
                            <span>会员中心</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/me/orders">
                            <Grid2X2 className="mr-2 h-4 w-4" />
                            <span>我的订单</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/me/assets">
                            <Grid2X2 className="mr-2 h-4 w-4" />
                            <span>我的资产</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          扩展入口
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href="/ai">
                            <BrainCircuit className="mr-2 h-4 w-4" />
                            <span>AI 辅导</span>
                          </Link>
                        </DropdownMenuItem>
                        {canAccessTenant ? (
                          <DropdownMenuItem asChild>
                            <Link href="/tenant">
                              <Grid2X2 className="mr-2 h-4 w-4" />
                              <span>机构工作台</span>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {canAccessParent ? (
                          <DropdownMenuItem asChild>
                            <Link href="/parent">
                              <Baby className="mr-2 h-4 w-4" />
                              <span>家长报告</span>
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {isAdmin ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href="/admin">
                                <Grid2X2 className="mr-2 h-4 w-4" />
                                <span>管理后台</span>
                              </Link>
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>退出登录</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline" className="hidden lg:inline-flex">
                      Public Beta
                    </Badge>
                    <Button variant="ghost" asChild>
                      <Link href="/login">登录</Link>
                    </Button>
                    <Button asChild>
                      <Link href="/register">注册</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <nav className="grid min-w-0 grid-cols-5 gap-2 border-t border-border/15 pt-4">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "focus-ring inline-flex min-h-11 items-center justify-center rounded-[1.25rem] px-2 py-2 text-center text-xs font-semibold transition-all sm:text-sm lg:text-base",
                      active
                        ? "border-[3px] border-border bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                        : "border-[2px] border-transparent text-muted-foreground hover:border-border/30 hover:bg-secondary/30 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}
