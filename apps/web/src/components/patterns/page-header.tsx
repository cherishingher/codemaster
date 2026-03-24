import * as React from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  aside,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "surface-panel overflow-hidden rounded-[2.2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(227,239,248,0.7),rgba(245,184,167,0.2))]",
        className,
      )}
    >
      <div className="grid gap-6 px-6 py-7 md:px-8 md:py-9 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="space-y-5">
          {eyebrow ? <div className="ui-eyebrow">{eyebrow}</div> : null}
          <div className="space-y-3">
            <h1 className="max-w-4xl text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                {description}
              </p>
            ) : null}
          </div>
          {meta ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {meta}
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {aside ? (
          <div className="surface-inset rounded-[1.8rem] p-5 md:p-6">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  )
}
