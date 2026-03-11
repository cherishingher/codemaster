import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function ProductPromoPanel({
  badge,
  title,
  description,
  href,
  ctaLabel,
}: {
  badge: string
  title: string
  description: string
  href: string
  ctaLabel: string
}) {
  return (
    <Card className="bg-gradient-to-br from-primary/8 via-background to-secondary">
      <CardContent className="space-y-4 p-5">
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          {badge}
        </Badge>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={href}>
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
