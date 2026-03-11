"use client"

import Link from "next/link"
import { ArrowRight, LockKeyhole } from "lucide-react"
import type { ContentAccessProductRecommendation } from "@/lib/content-access"
import { formatPriceCents, getProductTypeLabel } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export function RecommendedProductsList({
  products,
  loginHref = "/login",
  loggedIn = false,
}: {
  products: ContentAccessProductRecommendation[]
  loginHref?: string
  loggedIn?: boolean
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-[1.4rem] border-[2px] border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        当前还没有匹配到可解锁该资源的商品，建议先联系管理员检查商品绑定关系。
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {products.map((product) => (
        <Card key={product.id} className="bg-background">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    {getProductTypeLabel(product.type)}
                  </Badge>
                  <Badge variant="secondary">{product.defaultSku.name}</Badge>
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-semibold text-foreground">{product.name}</h4>
                  {product.summary ? (
                    <p className="text-sm leading-7 text-muted-foreground">{product.summary}</p>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-foreground">
                  {formatPriceCents(product.defaultSku.priceCents, product.defaultSku.currency)}
                </p>
                {product.defaultSku.originalPriceCents ? (
                  <p className="text-xs text-muted-foreground line-through">
                    {formatPriceCents(product.defaultSku.originalPriceCents, product.defaultSku.currency)}
                  </p>
                ) : null}
              </div>
            </div>

            {product.benefits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.benefits.slice(0, 4).map((benefit) => (
                  <Badge key={benefit.id} variant="outline" className="bg-card">
                    {benefit.title}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link
                  href={
                    loggedIn
                      ? `/checkout?productId=${encodeURIComponent(product.id)}&skuId=${encodeURIComponent(product.defaultSku.id)}`
                      : loginHref
                  }
                >
                  <LockKeyhole className="size-4" />
                  立即解锁
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`/products/${product.slug ?? product.id}`}>
                  查看商品详情
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
