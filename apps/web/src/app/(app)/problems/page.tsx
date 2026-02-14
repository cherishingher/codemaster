"use client"

import * as React from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search } from "lucide-react"
import { api } from "@/lib/api-client"
import useSWR from "swr"

// Type definition (move to types later)
interface Problem {
  id: string;
  title: string;
  difficulty: number;
  source?: string | null;
  version?: number | null;
  tags?: string[];
  visibility?: string | null;
}

export default function ProblemsPage() {
  const { data: problems, error, isLoading } = useSWR<Problem[]>(
    '/problems',
    async () => (await api.problems.list()) as Problem[]
  );

  const [search, setSearch] = React.useState("")
  const [scratchOnly, setScratchOnly] = React.useState(false)

  const filteredProblems = (problems ?? [])
    .filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags ?? []).some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
    )
    .filter((p) => {
      if (!scratchOnly) return true
      return (p.tags ?? []).some((tag) => tag.toLowerCase().includes("scratch"))
    });

  const getDifficultyLabel = (value: number) => {
    if (value <= 2) return "Easy"
    if (value <= 4) return "Medium"
    return "Hard"
  }

  const getDifficultyColor = (label: string) => {
    switch (label) {
      case "Easy":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      case "Medium":
        return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
      case "Hard":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500"
    }
  }

  const getTagClass = (tag: string) => {
    const normalized = tag.toLowerCase();
    if (normalized.includes("scratch") && (normalized.includes("必") || normalized.includes("must"))) {
      return "bg-red-500/10 text-red-300 border-red-500/30";
    }
    if (normalized.includes("scratch")) {
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    }
    return "bg-zinc-800/70 text-zinc-200 border-zinc-700/60";
  };

  return (
    <div className="container py-6 sm:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">题库</h1>
          <p className="text-muted-foreground mt-2">
            精选算法题目，提升编程能力
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索题目或标签..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={`h-9 rounded-md border px-3 text-sm transition-colors ${
              scratchOnly
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-zinc-700"
            }`}
            onClick={() => setScratchOnly((v) => !v)}
          >
            仅看 Scratch 题
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            题库加载失败，请稍后重试。
          </div>
        ) : null}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">加载中...</div>
        ) : null}
        {!isLoading && !error && filteredProblems.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            暂无公开题目。请在管理端将题目设为公开后再查看。
          </div>
        ) : null}
        {filteredProblems.map((problem) => {
          const label = getDifficultyLabel(problem.difficulty)
          return (
            <Link key={problem.id} href={`/problems/${problem.id}`}>
              <Card className="transition-all hover:bg-muted/50">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap sm:gap-4">
                      <span className="font-mono text-xs text-muted-foreground sm:text-sm">
                        #{problem.id}
                      </span>
                      <span className="font-medium text-base sm:text-lg">
                        {problem.title}
                      </span>
                      <Badge variant="secondary" className={getDifficultyColor(label)}>
                        {label}
                      </Badge>
                      {problem.visibility && problem.visibility !== "public" ? (
                        <Badge variant="secondary" className="bg-orange-500/10 text-orange-400">
                          未公开
                        </Badge>
                      ) : null}
                    </div>
                    {problem.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {problem.tags.map((tag) => (
                          <Badge
                            key={`${problem.id}-${tag}`}
                            variant="outline"
                            className={getTagClass(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    版本: {problem.version ?? "-"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
