"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Search } from "lucide-react"
import { api } from "@/lib/api-client"
import type { CampListResponse } from "@/lib/camps"
import { CampCard } from "@/components/camps/camp-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CampsPage() {
  const [q, setQ] = React.useState("")
  const [committedQ, setCommittedQ] = React.useState("")

  const { data, error, isLoading } = useSWR<CampListResponse>(
    `/camps?q=${encodeURIComponent(committedQ)}`,
    () => api.camps.list<CampListResponse>(committedQ ? { q: committedQ } : undefined),
  )

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Camp</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">训练营</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            基于一期商品、订单、支付、权限和学习数据底座搭出的高客单价训练产品，先跑通报名到结营的最小闭环。
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/">
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
        </Button>
      </div>

      <form
        className="mb-8 flex gap-2 rounded-[1.8rem] border-[3px] border-border bg-card p-4 shadow-[10px_10px_0_hsl(var(--border))]"
        onSubmit={(event) => {
          event.preventDefault()
          setCommittedQ(q.trim())
        }}
      >
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索训练营主题或简介" />
        <Button type="submit">
          <Search className="size-4" />
          搜索
        </Button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          训练营列表加载失败，请稍后重试。
        </div>
      ) : null}

      {isLoading && !data ? <div className="text-sm text-muted-foreground">训练营加载中...</div> : null}

      {!isLoading && data?.data.length === 0 ? (
        <div className="rounded-[1.8rem] border-[3px] border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[10px_10px_0_hsl(var(--border))]">
          当前还没有匹配的训练营。
        </div>
      ) : null}

      {data?.data.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {data.data.map((camp) => (
            <CampCard key={camp.id} camp={camp} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
