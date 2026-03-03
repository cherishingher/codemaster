"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { SubmissionResult } from "@/components/problems/submission-result";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export default function SubmissionDetailPage() {
  const params = useParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const { data: submission, error, isLoading } = useSWR(
    id ? `/submissions/${id}` : null,
    () => api.submissions.get(id)
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

  if (!id) return null;

  if (error) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          {(error as ApiError).status === 401
            ? "请先登录查看提交记录"
            : (error as ApiError).status === 403
            ? "无权访问此提交记录"
            : "加载失败，请稍后重试"}
          <div className="mt-4 flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/submissions">返回列表</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="text-sm text-zinc-500">加载中...</div>
      </div>
    );
  }

  if (!submission) return null;

  const isFinished = !["PENDING", "QUEUED", "JUDGING", "RUNNING"].includes(
    submission.status
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "我的提交", href: "/submissions" },
            { label: "提交详情" },
          ]}
        />
      </div>

      <div className="mb-6 rounded-md border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              <span className={getStatusColor(submission.status)}>
                {getStatusLabel(submission.status)}
              </span>
            </h1>
            <div className="text-sm text-zinc-400">
              提交于{" "}
              {new Date(submission.createdAt).toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          </div>
          <div className="flex gap-6 rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500">时间</span>
              <span className="font-mono text-zinc-200">
                {submission.timeUsed !== undefined && submission.timeUsed !== null
                  ? `${submission.timeUsed} ms`
                  : "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500">内存</span>
              <span className="font-mono text-zinc-200">
                {submission.memoryUsed !== undefined && submission.memoryUsed !== null
                  ? `${submission.memoryUsed} MB`
                  : "-"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500">分数</span>
              <span className="font-mono text-zinc-200">
                {submission.score !== undefined && submission.score !== null
                  ? submission.score
                  : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">评测详情</h2>
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
            <SubmissionResult
              submission={submission}
              isLoading={!isFinished}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
