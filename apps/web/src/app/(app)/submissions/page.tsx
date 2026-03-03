"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

export default function SubmissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const problemId = searchParams.get("problemId") || "";
  const page = parseInt(searchParams.get("page") || "1");

  const { data, error, isLoading } = useSWR(
    `/submissions?problemId=${problemId}&page=${page}`,
    () => api.submissions.list({ problemId, page: String(page) })
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
      case "AC":
        return "text-green-500";
      case "WRONG_ANSWER":
      case "WA":
      case "RUNTIME_ERROR":
      case "RE":
      case "COMPILE_ERROR":
      case "CE":
      case "TIME_LIMIT_EXCEEDED":
      case "TLE":
      case "MEMORY_LIMIT_EXCEEDED":
      case "MLE":
        return "text-red-500";
      case "SYSTEM_ERROR":
      case "SE":
      case "FAILED":
        return "text-zinc-500";
      case "PENDING":
      case "JUDGING":
      case "QUEUED":
      case "RUNNING":
      default:
        return "text-blue-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACCEPTED":
      case "AC":
        return "通过";
      case "WRONG_ANSWER":
      case "WA":
        return "解答错误";
      case "TIME_LIMIT_EXCEEDED":
      case "TLE":
        return "超出时间限制";
      case "MEMORY_LIMIT_EXCEEDED":
      case "MLE":
        return "超出内存限制";
      case "RUNTIME_ERROR":
      case "RE":
        return "运行错误";
      case "COMPILE_ERROR":
      case "CE":
        return "编译错误";
      case "SYSTEM_ERROR":
      case "SE":
      case "FAILED":
        return "系统错误";
      case "PENDING":
      case "QUEUED":
        return "等待中";
      case "JUDGING":
      case "RUNNING":
        return "评测中";
      default:
        return status;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的提交</h1>
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-800 overflow-hidden bg-zinc-950">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium w-48">提交时间</th>
              <th className="px-4 py-3 font-medium">题目</th>
              <th className="px-4 py-3 font-medium w-32">状态</th>
              <th className="px-4 py-3 font-medium w-24">语言</th>
              <th className="px-4 py-3 font-medium w-20">得分</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-red-500">
                  {error.status === 401 ? "请先登录查看提交记录" : "加载失败"}
                </td>
              </tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  没有找到提交记录
                </td>
              </tr>
            ) : (
              data?.data.map((sub: any, idx: number) => (
                <tr
                  key={sub.id}
                  className={`border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors ${
                    idx % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(sub.createdAt).toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/problems/${sub.problemId}`}
                      className="font-medium hover:text-blue-400 transition-colors"
                    >
                      {sub.problemTitle || sub.problemId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/submissions/${sub.id}`}
                      className={`font-medium hover:underline ${getStatusColor(
                        sub.status
                      )}`}
                    >
                      {getStatusLabel(sub.status)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {sub.lang.startsWith("scratch") ? "Scratch" : sub.lang}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {sub.score !== undefined && sub.score !== null ? sub.score : "-"}
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
              router.push(`/submissions?${params.toString()}`);
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
              router.push(`/submissions?${params.toString()}`);
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
