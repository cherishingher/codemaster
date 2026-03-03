"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { api } from "@/lib/api-client";
import useSWR from "swr";

export default function ProblemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") || "";
  const difficulty = searchParams.get("difficulty") || "";
  const tag = searchParams.get("tag") || "";
  const page = parseInt(searchParams.get("page") || "1");

  const [searchInput, setSearchInput] = React.useState(q);

  const { data, error, isLoading } = useSWR(
    `/problems?q=${q}&difficulty=${difficulty}&tag=${tag}&page=${page}`,
    () => api.problems.list({ q, difficulty, tag, page: String(page) })
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput) params.set("q", searchInput);
    else params.delete("q");
    params.set("page", "1");
    router.push(`/problems?${params.toString()}`);
  };

  const setDifficulty = (val: string) => {
    const params = new URLSearchParams(searchParams);
    if (val) params.set("difficulty", val);
    else params.delete("difficulty");
    params.set("page", "1");
    router.push(`/problems?${params.toString()}`);
  };

  const getDifficultyLabel = (value: number) => {
    if (value <= 2) return "简单";
    if (value <= 4) return "中等";
    return "困难";
  };

  const getDifficultyColor = (value: number) => {
    if (value <= 2) return "text-green-500";
    if (value <= 4) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">题库</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索题目..."
            className="pl-9 bg-zinc-900 border-zinc-800"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>

        <div className="flex gap-2">
          <select
            className="h-10 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">难度</option>
            <option value="1">简单</option>
            <option value="3">中等</option>
            <option value="5">困难</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-800 overflow-hidden bg-zinc-950">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium w-16">状态</th>
              <th className="px-4 py-3 font-medium">题目</th>
              <th className="px-4 py-3 font-medium w-24">难度</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">标签</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-red-500">
                  加载失败
                </td>
              </tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  没有找到题目
                </td>
              </tr>
            ) : (
              data?.data.map((problem: any, idx: number) => (
                <tr
                  key={problem.id}
                  className={`border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors ${
                    idx % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-4 py-3">
                    {/* Placeholder for status icon (solved/attempted) */}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/problems/${problem.id}`}
                      className="font-medium hover:text-blue-400 transition-colors"
                    >
                      {problem.title}
                    </Link>
                    {problem.visibility !== "public" && (
                      <Badge variant="outline" className="ml-2 text-xs opacity-50">
                        未公开
                      </Badge>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${getDifficultyColor(problem.difficulty)}`}>
                    {getDifficultyLabel(problem.difficulty)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {problem.tags?.map((t: string) => (
                        <span key={t} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set("page", String(page - 1));
              router.push(`/problems?${params.toString()}`);
            }}
            className="px-3 py-1 text-sm border border-zinc-800 rounded-md disabled:opacity-50 hover:bg-zinc-900"
          >
            上一页
          </button>
          <span className="text-sm text-zinc-500">
            {page} / {data.meta.totalPages}
          </span>
          <button
            disabled={page >= data.meta.totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set("page", String(page + 1));
              router.push(`/problems?${params.toString()}`);
            }}
            className="px-3 py-1 text-sm border border-zinc-800 rounded-md disabled:opacity-50 hover:bg-zinc-900"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
