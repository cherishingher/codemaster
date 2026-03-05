import * as React from "react";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  title: string;
  description?: string;
  summary?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function FilterBar({
  title,
  description,
  summary,
  actions,
  children,
  className,
}: FilterBarProps) {
  return (
    <section
      className={cn(
        "surface-panel overflow-hidden rounded-[1.9rem]",
        className,
      )}
    >
      <div className="border-b-[3px] border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.8),rgba(245,184,167,0.16))] px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
            {summary ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                {summary}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className="bg-card px-5 py-5 md:px-6">
        <div className="grid gap-3">{children}</div>
      </div>
    </section>
  );
}
