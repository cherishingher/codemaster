"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
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
import { Code2, Grid2X2, LogOut, User } from "lucide-react"

const navItems = [
  { href: "/learn", label: "视频学习" },
  { href: "/problems", label: "题库" },
  { href: "/submissions", label: "提交" },
  { href: "/contests", label: "竞赛" },
  { href: "/discuss", label: "讨论" },
  { href: "/graphical", label: "图形化" },
]

export function Navbar() {
  const { user, loggedIn, logout } = useAuth()
  const pathname = usePathname()
  const isProblemWorkspace =
    pathname?.startsWith("/problems/") &&
    pathname.split("/").filter(Boolean).length === 2

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-background/95 px-4",
        isProblemWorkspace ? "py-2.5" : "py-5"
      )}
    >
      <div className="page-wrap">
        <div
          className={cn(
            "flex items-center gap-4 rounded-[2.25rem] border-[4px] border-border bg-card shadow-[14px_14px_0_hsl(var(--border))]",
            isProblemWorkspace
              ? "min-h-[4.6rem] px-4 py-2"
              : "min-h-[5.75rem] px-5 py-4"
          )}
        >
        <Link href="/" className="flex items-center gap-4 rounded-full pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80">
          <div
            className={cn(
              "flex items-center justify-center rounded-[1.4rem] bg-accent text-foreground",
              isProblemWorkspace ? "size-12" : "size-14"
            )}
          >
            <Code2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-semibold tracking-tight text-foreground",
                isProblemWorkspace ? "text-xl" : "text-2xl"
              )}
            >
              CodeMaster
            </p>
            <p
              className={cn(
                "truncate uppercase tracking-[0.24em] text-muted-foreground",
                isProblemWorkspace ? "text-[10px]" : "text-[11px]"
              )}
            >
              Practice Workspace
            </p>
          </div>
        </Link>

        <nav
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto text-sm font-semibold",
            isProblemWorkspace ? "pb-0" : "pb-1"
          )}
        >
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring inline-flex shrink-0 items-center rounded-full transition-all",
                  isProblemWorkspace ? "px-4 py-2 text-sm" : "px-4 py-2.5 text-base",
                  active
                    ? "border-2 border-border bg-primary text-primary-foreground shadow-[5px_5px_0_hsl(var(--border))]"
                    : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {loggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "relative gap-3 rounded-full pl-2 pr-4",
                    isProblemWorkspace ? "h-12" : "h-14"
                  )}
                >
                  <Avatar className={cn(isProblemWorkspace ? "h-7 w-7" : "h-8 w-8")}>
                    <AvatarImage src={user?.avatar ?? undefined} alt={user?.name || "User"} />
                    <AvatarFallback>{user?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="max-w-32 truncate text-sm font-semibold text-foreground">
                      {user?.name || "User"}
                    </p>
                    <p className="max-w-32 truncate text-xs text-muted-foreground">
                      {user?.email ?? user?.phone ?? "已登录"}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email ?? user?.phone}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === "admin" || user?.roles?.includes("admin") ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Grid2X2 className="mr-2 h-4 w-4" />
                      <span>管理后台</span>
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>个人中心</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/submissions">
                    <Code2 className="mr-2 h-4 w-4" />
                    <span>我的提交</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden md:inline-flex border-2 border-border bg-white px-3 py-1">
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
      </div>
    </header>
  )
}
