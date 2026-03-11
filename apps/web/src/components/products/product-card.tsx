import Link from "next/link"
import { ArrowRight, Layers3, Package2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPriceCents, type ProductListItem } from "@/lib/products"
import { ProductTagList, ProductTypeBadge } from "@/components/products/product-badges"

function Cover({ coverImage, type }: { coverImage?: string | null; type: string }) {
  if (coverImage) {
    return (
      <div
        className="aspect-[16/10] overflow-hidden rounded-2xl border border-border/60 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${coverImage})` }}
      />
    )
  }

  return (
    <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-primary/10 via-background to-secondary">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-2 text-sm text-muted-foreground">
        <Layers3 className="size-4" />
        {type === "membership"
          ? "会员权益"
          : type === "training_path"
            ? "训练路径"
            : type === "camp"
              ? "训练营"
              : type === "contest"
                ? "模拟赛"
                : "内容包"}
      </div>
    </div>
  )
}

export function ProductCard({
  product,
  actionLabel = "查看详情",
}: {
  product: ProductListItem
  actionLabel?: string
}) {
  const price = formatPriceCents(product.defaultSku.priceCents, product.defaultSku.currency)
  const originalPrice =
    product.defaultSku.originalPriceCents != null
      ? formatPriceCents(product.defaultSku.originalPriceCents, product.defaultSku.currency)
      : null

  return (
    <Card className="h-full bg-background transition-transform hover:-translate-y-0.5">
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <Cover coverImage={product.coverImage} type={product.type} />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ProductTypeBadge type={product.type} />
            <span className="text-xs text-muted-foreground">
              {product.skuCount > 1 ? `${product.skuCount} 个 SKU` : "单一规格"}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{product.name}</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {product.summary || product.description || "已配置商品权益，可被后续订单与支付模块直接复用。"}
            </p>
          </div>
          <ProductTagList tags={product.tags} />
        </div>

        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <span className="text-2xl font-semibold text-foreground">{price}</span>
            {originalPrice ? (
              <span className="text-sm text-muted-foreground line-through">{originalPrice}</span>
            ) : null}
          </div>
          {product.defaultSku.validDays ? (
            <p className="text-xs text-muted-foreground">有效期 {product.defaultSku.validDays} 天</p>
          ) : null}
        </div>

        <div className="space-y-2">
          {product.benefits.slice(0, 3).map((benefit) => (
            <div key={benefit.id} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Package2 className="mt-0.5 size-4 text-primary" />
              <span>{benefit.title}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <Button asChild className="w-full">
            <Link href={`/products/${product.id}`}>
              {actionLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
