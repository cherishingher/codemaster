import * as React from "react"
import { cn } from "@/lib/utils"

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  description?: string
  align?: "left" | "center"
  action?: React.ReactNode
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className,
}: SectionHeadingProps) {
  const centered = align === "center"

  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        centered && "items-center text-center md:flex-col md:items-center",
        className,
      )}
    >
      <div className="space-y-3">
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-[2.6rem]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-3">{action}</div> : null}
    </div>
  )
}
