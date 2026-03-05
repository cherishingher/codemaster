"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Footer } from "@/components/layout/footer"

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isProblemDetail =
    pathname?.startsWith("/problems/") &&
    pathname.split("/").filter(Boolean).length === 2
  const isGraphical = pathname?.startsWith("/graphical")

  return (
    <>
      <main className="relative min-h-0 flex-1">
        {!isProblemDetail && !isGraphical ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_30%)]" />
        ) : null}
        <div className="relative">{children}</div>
      </main>
      {!isProblemDetail && !isGraphical ? <Footer /> : null}
    </>
  )
}
