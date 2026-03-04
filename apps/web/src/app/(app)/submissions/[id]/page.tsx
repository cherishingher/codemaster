"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import { useSubmission } from "@/lib/hooks/use-submission"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SubmissionResult } from "@/components/problems/submission-result"

function formatMaybeDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-"
}

export default function SubmissionDetailPage() {
  const { user, loading } = useAuth({ redirectTo: "/login" })
  const params = useParams<{ id?: string | string[] }>()
  const submissionId = Array.isArray(params.id) ? params.id[0] : params.id ?? null
  const { submission, isLoading, isError } = useSubmission(submissionId)

  if (loading || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="container px-4 py-8 md:px-6">
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          提交详情加载失败，请确认权限或稍后重试。
        </div>
      </div>
    )
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <Link href="/submissions" className="hover:underline">
              提交列表
            </Link>
            <span className="mx-2">/</span>
            <span>{submissionId}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {submission?.problem?.title ?? "提交详情"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {submission?.problem?.slug ? (
              <Link
                href={`/problems/${submission.problem.slug}`}
                className="font-medium text-primary hover:underline"
              >
                跳转题目
              </Link>
            ) : null}
            <span>提交时间 {formatMaybeDate(submission?.createdAt)}</span>
            <span>完成时间 {formatMaybeDate(submission?.finishedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {submission?.status ? <Badge variant="outline">{submission.status}</Badge> : null}
          {submission?.rawStatus && submission.rawStatus !== submission.status ? (
            <Badge variant="outline">{submission.rawStatus}</Badge>
          ) : null}
          {submission?.judgeBackend ? <Badge variant="outline">{submission.judgeBackend}</Badge> : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在获取提交详情...
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">语言</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{submission?.language ?? "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">分数</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{submission?.score ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">耗时</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{submission?.timeUsed ?? 0} ms</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">内存</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{submission?.memoryUsed ?? 0} KB</CardContent>
        </Card>
      </div>

      <SubmissionResult submission={submission} isLoading={Boolean(isLoading && !submission)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>编译与运行信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="mb-1 font-medium">CompileInfo</div>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {submission?.compileInfo
                  ? JSON.stringify(submission.compileInfo, null, 2)
                  : "暂无编译信息"}
              </pre>
            </div>
            <div>
              <div className="mb-1 font-medium">RuntimeInfo</div>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                {submission?.runtimeInfo
                  ? JSON.stringify(submission.runtimeInfo, null, 2)
                  : "暂无运行信息"}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>源码</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>存储 {submission?.sourceCode?.storageType ?? "-"}</span>
              {submission?.sourceCode?.sourceSize ? (
                <span>大小 {submission.sourceCode.sourceSize} bytes</span>
              ) : null}
              {submission?.sourceCode?.objectKey ? (
                <span>对象 {submission.sourceCode.objectKey}</span>
              ) : null}
            </div>
            <pre className="max-h-[560px] overflow-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
              {submission?.sourceCode?.source ?? "当前提交未返回内联源码。"}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
