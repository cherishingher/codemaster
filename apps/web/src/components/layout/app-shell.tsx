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

  return (
    <>
      <main className="flex-1 min-h-0">{children}</main>
      {!isProblemDetail && <Footer />}
    </>
  )
}
