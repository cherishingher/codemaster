"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Package2, ShoppingBag } from "lucide-react"
import { api } from "@/lib/api-client"
import type { ProductListResponse } from "@/lib/products"
import { ProductCard } from "@/components/products/product-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PRODUCT_TYPES = [
  { value: "", label: "全部商品" },
  { value: "membership", label: "会员商品" },
  { value: "training_path", label: "训练路径商品" },
  { value: "content_pack", label: "内容包商品" },
  { value: "camp", label: "训练营商品" },
  { value: "contest", label: "模拟赛商品" },
]

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export default function ProductsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = React.useState(searchParams.get("q") ?? "")

  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = 12
  const type = searchParams.get("type") ?? ""
  const q = searchParams.get("q") ?? ""

  React.useEffect(() => {
    setSearchInput(q)
  }, [q])

  const params = React.useMemo(
    () => ({
      page: String(page),
      pageSize: String(pageSize),
      ...(type ? { type } : {}),
      ...(q ? { q } : {}),
    }),
    [page, pageSize, q, type],
  )

  const { data, error, isLoading } = useSWR<ProductListResponse>(
    `/products?${new URLSearchParams(params).toString()}`,
    () => api.products.list<ProductListResponse>(params),
  )

  const updateQuery = React.useCallback(
    (next: { page?: number; type?: string; q?: string }) => {
      const query = new URLSearchParams(searchParams.toString())

      if (next.page && next.page > 1) query.set("page", String(next.page))
      else query.delete("page")

      const nextType = next.type ?? type
      if (nextType) query.set("type", nextType)
      else query.delete("type")

      const nextQ = next.q ?? q
      if (nextQ) query.set("q", nextQ)
      else query.delete("q")

      router.replace(query.toString() ? `${pathname}?${query.toString()}` : pathname, { scroll: false })
    },
    [pathname, q, router, searchParams, type],
  )

  return (
    <div className="page-wrap py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Store</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">商品中心</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            统一承载会员商品、训练路径商品和内容包商品。当前先完成商品展示与资产聚合，后续订单模块直接复用这套数据。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/me/orders">
              <ShoppingBag className="size-4" />
              我的订单
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/me/assets">
              <Package2 className="size-4" />
              我的资产
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/content-packs">内容包专区</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">
              <ArrowLeft className="size-4" />
              返回首页
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 rounded-[1.8rem] border-[3px] border-border bg-card p-5 shadow-[10px_10px_0_hsl(var(--border))] md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRODUCT_TYPES.map((option) => (
              <Button
                key={option.value || "all"}
                variant={type === option.value ? "default" : "secondary"}
                onClick={() => updateQuery({ type: option.value, page: 1 })}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            支持按类型筛选，列表数据直接来自商品中心后端接口。
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            updateQuery({ q: searchInput.trim(), page: 1 })
          }}
        >
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索商品名称或简介"
            className="min-w-[220px]"
          />
          <Button type="submit">
            <ShoppingBag className="size-4" />
            搜索
          </Button>
        </form>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          商品列表加载失败，请稍后重试。
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground">商品加载中...</div>
      ) : null}

      {!isLoading && data && data.data.length === 0 ? (
        <div className="rounded-[1.8rem] border-[3px] border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[10px_10px_0_hsl(var(--border))]">
          当前筛选条件下还没有商品。
        </div>
      ) : null}

      {data?.data?.length ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {data.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              共 {data.meta.total} 个商品，第 {Math.max(data.meta.page, 1)} / {Math.max(data.meta.totalPages, 1)} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => updateQuery({ page: page - 1 })}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                disabled={data.meta.totalPages === 0 || page >= data.meta.totalPages}
                onClick={() => updateQuery({ page: page + 1 })}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
