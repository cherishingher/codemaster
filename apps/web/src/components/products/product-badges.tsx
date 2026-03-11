import { Badge } from "@/components/ui/badge"
import { getProductTypeLabel } from "@/lib/products"

function getTypeClass(type: string) {
  switch (type) {
    case "membership":
    case "video_membership":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700"
    case "training_path":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700"
    case "content_pack":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    case "camp":
      return "border-rose-500/40 bg-rose-500/10 text-rose-700"
    case "contest":
      return "border-violet-500/40 bg-violet-500/10 text-violet-700"
    default:
      return "border-border bg-secondary text-foreground"
  }
}

export function ProductTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={getTypeClass(type)}>
      {getProductTypeLabel(type)}
    </Badge>
  )
}

export function ProductTagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
