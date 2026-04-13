export default function ProblemDetailLoading() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden py-2 md:py-3">
      <div className="mb-3 shrink-0 rounded-[1.5rem] border-[3px] border-border bg-card px-4 py-3 shadow-[8px_8px_0_hsl(var(--border))]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="h-5 w-56 animate-pulse rounded-full bg-secondary/80" />
            <div className="h-4 w-72 animate-pulse rounded-full bg-secondary/60" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-24 animate-pulse rounded-[1rem] bg-secondary/70" />
            <div className="h-10 w-20 animate-pulse rounded-[1rem] bg-secondary/70" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:overflow-hidden">
        <div className="flex-1 rounded-[1.8rem] border-[3px] border-border bg-card p-3 shadow-[10px_10px_0_hsl(var(--border))] md:min-h-0 md:w-[46%] md:overflow-y-auto md:overscroll-contain md:p-4">
          <div className="mb-4 h-10 w-40 animate-pulse rounded-2xl bg-secondary/80" />
          <div className="mb-4 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-9 w-24 animate-pulse rounded-[1rem] bg-secondary/70"
              />
            ))}
          </div>
          <div className="mb-4 h-12 animate-pulse rounded-[1.2rem] bg-secondary/60" />
          <div className="mb-4 h-40 animate-pulse rounded-[1.5rem] bg-secondary/55" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-5 animate-pulse rounded-full bg-secondary/50"
              />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col rounded-[1.8rem] border-[3px] border-border bg-card shadow-[10px_10px_0_hsl(var(--border))] md:min-h-0 md:w-[54%] md:overflow-hidden">
          <div className="border-b-[3px] border-border bg-background px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-36 animate-pulse rounded-[1rem] bg-secondary/70" />
                <div className="h-10 w-28 animate-pulse rounded-[1rem] bg-secondary/60" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-24 animate-pulse rounded-[1rem] bg-secondary/60" />
                <div className="h-10 w-24 animate-pulse rounded-[1rem] bg-secondary/80" />
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <div className="h-full min-h-[420px] animate-pulse rounded-[1.4rem] border-[3px] border-border bg-background/70" />
          </div>
        </div>
      </div>
    </div>
  )
}
