"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import type {
  OrganizationsResponse,
  TeachingGroupDetailResponse,
} from "@/lib/edu-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

async function fetcher<T>(url: string) {
  const response = await fetch(url, { credentials: "include" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || "加载失败")
  }
  return payload as T
}

type ProblemSetListResponse = {
  items: Array<{
    id: string
    title: string
    visibility: string
    count: number
  }>
}

export default function AdminTeachingGroupDetailPage() {
  const params = useParams<{ id: string }>()
  const groupId = typeof params?.id === "string" ? params.id : ""
  const { data: detailResponse, error, mutate } = useSWR<TeachingGroupDetailResponse>(
    groupId ? `/api/admin/teaching-groups/${groupId}` : null,
    fetcher,
  )
  const { data: organizationsResponse } = useSWR<OrganizationsResponse>("/api/admin/organizations", fetcher)
  const { data: problemSetsResponse } = useSWR<ProblemSetListResponse>(
    "/api/admin/problem-sets?pageSize=100",
    fetcher,
  )
  const [memberInput, setMemberInput] = React.useState("")
  const [savingMeta, setSavingMeta] = React.useState(false)
  const [savingMembers, setSavingMembers] = React.useState(false)
  const [importingMembers, setImportingMembers] = React.useState(false)
  const [savingAssignment, setSavingAssignment] = React.useState(false)

  const group = detailResponse?.data

  const [metaForm, setMetaForm] = React.useState({
    organizationId: "",
    ownerIdentifier: "",
    slug: "",
    name: "",
    code: "",
    groupType: "class",
    status: "draft",
    summary: "",
    startAt: "",
    endAt: "",
  })
  const [assignmentForm, setAssignmentForm] = React.useState({
    problemSetId: "",
    title: "",
    note: "",
    dueAt: "",
  })

  React.useEffect(() => {
    if (!group) return
    setMetaForm({
      organizationId: group.organization?.id || "",
      ownerIdentifier: group.owner.email || group.owner.id,
      slug: group.slug,
      name: group.name,
      code: group.code || "",
      groupType: group.groupType,
      status: group.status,
      summary: group.summary || "",
      startAt: group.startAt || "",
      endAt: group.endAt || "",
    })
    setMemberInput(
      group.members
        .map((member) => `${member.user.email || member.user.phone || member.user.id},${member.memberRole},${member.status}`)
        .join("\n"),
    )
  }, [group])

  const saveMeta = async () => {
    if (!groupId) return
    setSavingMeta(true)
    try {
      const response = await fetch(`/api/admin/teaching-groups/${groupId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...metaForm,
          organizationId: metaForm.organizationId || null,
          code: metaForm.code || null,
          summary: metaForm.summary || null,
          startAt: metaForm.startAt || null,
          endAt: metaForm.endAt || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "教学组更新失败")
      }
      await mutate()
      toast.success("教学组信息已更新")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "教学组更新失败")
    } finally {
      setSavingMeta(false)
    }
  }

  const saveMembers = async () => {
    if (!groupId) return
    setSavingMembers(true)
    try {
      const members = memberInput
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [userIdentifier, memberRole, status] = line.split(",").map((item) => item.trim())
          return {
            userIdentifier,
            memberRole: memberRole || "student",
            status: status || "active",
          }
        })
      const response = await fetch(`/api/admin/teaching-groups/${groupId}/members`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "成员更新失败")
      }
      await mutate()
      toast.success("教学组成员已更新")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "成员更新失败")
    } finally {
      setSavingMembers(false)
    }
  }

  const importMembers = async () => {
    if (!groupId || !memberInput.trim()) return
    setImportingMembers(true)
    try {
      const response = await fetch(`/api/admin/teaching-groups/${groupId}/import-members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: memberInput,
          defaultRole: "student",
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "导入学生失败")
      }
      await mutate()
      toast.success(`已导入 ${payload?.data?.importedCount ?? 0} 名成员`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入学生失败")
    } finally {
      setImportingMembers(false)
    }
  }

  const createAssignment = async () => {
    if (!groupId || !assignmentForm.problemSetId) return
    setSavingAssignment(true)
    try {
      const response = await fetch(`/api/admin/teaching-groups/${groupId}/assignments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemSetId: assignmentForm.problemSetId,
          title: assignmentForm.title || undefined,
          note: assignmentForm.note || undefined,
          dueAt: assignmentForm.dueAt || undefined,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.message || "题单布置失败")
      }
      setAssignmentForm({
        problemSetId: "",
        title: "",
        note: "",
        dueAt: "",
      })
      await mutate()
      toast.success("题单已布置到班级")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "题单布置失败")
    } finally {
      setSavingAssignment(false)
    }
  }

  if (error) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">教学组详情加载失败。</div>
  }

  if (!group) {
    return <div className="container px-4 py-8 md:px-6 text-sm text-muted-foreground">教学组详情加载中...</div>
  }

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{group.groupType}</Badge>
            <Badge variant="outline">{group.status}</Badge>
            {group.organization ? <Badge variant="outline">{group.organization.name}</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{group.name}</h1>
          <p className="mt-2 text-muted-foreground">
            slug: {group.slug} · 成员 {group.memberCount} · 负责人 {group.owner.name || group.owner.email || group.owner.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/admin/teaching-groups/${group.id}/stats`}>查看班级统计</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/classes">返回班级列表</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">基础信息</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={metaForm.organizationId}
              onChange={(e) => setMetaForm((current) => ({ ...current, organizationId: e.target.value }))}
            >
              <option value="">不挂机构</option>
              {(organizationsResponse?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Input value={metaForm.ownerIdentifier} onChange={(e) => setMetaForm((current) => ({ ...current, ownerIdentifier: e.target.value }))} placeholder="负责人 ID / 邮箱 / 手机号" />
            <Input value={metaForm.slug} onChange={(e) => setMetaForm((current) => ({ ...current, slug: e.target.value }))} placeholder="slug" />
            <Input value={metaForm.name} onChange={(e) => setMetaForm((current) => ({ ...current, name: e.target.value }))} placeholder="班级名称" />
            <Input value={metaForm.code} onChange={(e) => setMetaForm((current) => ({ ...current, code: e.target.value }))} placeholder="编码" />
            <Input value={metaForm.groupType} onChange={(e) => setMetaForm((current) => ({ ...current, groupType: e.target.value }))} placeholder="groupType" />
            <Input value={metaForm.status} onChange={(e) => setMetaForm((current) => ({ ...current, status: e.target.value }))} placeholder="status" />
            <Input value={metaForm.startAt} onChange={(e) => setMetaForm((current) => ({ ...current, startAt: e.target.value }))} placeholder="开始时间 ISO" />
            <Input value={metaForm.endAt} onChange={(e) => setMetaForm((current) => ({ ...current, endAt: e.target.value }))} placeholder="结束时间 ISO" />
          </div>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={metaForm.summary}
            onChange={(e) => setMetaForm((current) => ({ ...current, summary: e.target.value }))}
            placeholder="班级简介"
          />
          <Button onClick={saveMeta} disabled={savingMeta || !metaForm.name.trim() || !metaForm.ownerIdentifier.trim()}>
            {savingMeta ? "保存中..." : "保存班级信息"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">学生导入 / 成员维护</h2>
            <div className="text-sm text-muted-foreground">支持：邮箱 或 姓名,邮箱,手机号,角色,状态</div>
          </div>
          <textarea
            className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            placeholder={"student@example.com\n张三,zhangsan@example.com,13800138000,student,active"}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={importMembers} disabled={importingMembers || !memberInput.trim()}>
              {importingMembers ? "导入中..." : "导入学生（合并）"}
            </Button>
            <Button onClick={saveMembers} disabled={savingMembers} variant="secondary">
              {savingMembers ? "保存中..." : "覆盖保存成员"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">题单布置</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={assignmentForm.problemSetId}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, problemSetId: e.target.value }))}
            >
              <option value="">选择题单</option>
              {(problemSetsResponse?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {item.count} 题
                </option>
              ))}
            </select>
            <Input
              placeholder="布置标题（可选）"
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, title: e.target.value }))}
            />
            <Input
              placeholder="截止时间 ISO（可选）"
              value={assignmentForm.dueAt}
              onChange={(e) => setAssignmentForm((current) => ({ ...current, dueAt: e.target.value }))}
            />
          </div>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="布置说明（可选）"
            value={assignmentForm.note}
            onChange={(e) => setAssignmentForm((current) => ({ ...current, note: e.target.value }))}
          />
          <Button onClick={createAssignment} disabled={savingAssignment || !assignmentForm.problemSetId}>
            {savingAssignment ? "布置中..." : "布置题单"}
          </Button>

          {group.assignments.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前班级还没有布置题单。</div>
          ) : (
            <div className="space-y-3">
              {group.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{assignment.status}</Badge>
                    <Badge variant="outline">{assignment.problemSet.visibility}</Badge>
                  </div>
                  <div className="mt-2 font-medium text-foreground">{assignment.title || assignment.problemSet.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {assignment.problemSet.itemCount} 题 · 布置人 {assignment.assignedBy.name || assignment.assignedBy.email || assignment.assignedBy.id}
                    {assignment.dueAt ? ` · 截止 ${assignment.dueAt}` : ""}
                  </div>
                  {assignment.note ? <div className="mt-2 text-sm text-muted-foreground">{assignment.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">关联训练营班级</h2>
          {group.campClasses.length === 0 ? (
            <div className="text-sm text-muted-foreground">当前还没有训练营班级挂到这个教学组。</div>
          ) : (
            <div className="space-y-3">
              {group.campClasses.map((campClass) => (
                <div key={campClass.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{campClass.status}</Badge>
                    <Badge variant="outline">{campClass.slug}</Badge>
                  </div>
                  <div className="mt-2 font-medium text-foreground">{campClass.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {campClass.startAt} - {campClass.endAt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
