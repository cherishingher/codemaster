"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { api, ApiError } from "@/lib/api-client"
import type {
  AdminProductDetailResponse,
  AdminProductListResponse,
  ProductMutationInput,
} from "@/lib/products"
import { getProductTypeLabel } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type ProductFormState = {
  name: string
  slug: string
  summary: string
  description: string
  coverImage: string
  type: string
  status: string
  currency: string
  sortOrder: string
  tags: string
  targetType: string
  targetId: string
  skuJson: string
  benefitJson: string
  metadataJson: string
}

function createEmptyForm(): ProductFormState {
  return {
    name: "",
    slug: "",
    summary: "",
    description: "",
    coverImage: "",
    type: "membership",
    status: "active",
    currency: "CNY",
    sortOrder: "0",
    tags: "",
    targetType: "",
    targetId: "",
    skuJson: JSON.stringify(
      [
        {
          skuCode: "default",
          name: "标准版",
          priceCents: 29900,
          originalPriceCents: 39900,
          currency: "CNY",
          validDays: 365,
          status: "active",
          isDefault: true,
          sortOrder: 0,
        },
      ],
      null,
      2,
    ),
    benefitJson: JSON.stringify(
      [
        {
          title: "解锁核心权益",
          description: "可被订单与权益模块直接复用",
          benefitType: "text",
          sortOrder: 0,
        },
      ],
      null,
      2,
    ),
    metadataJson: JSON.stringify(
      {
        includedTargets: [
          {
            type: "training_path",
            id: "advanced-algorithms",
            title: "高级算法路径",
            summary: "解锁高级算法专题路径",
          },
          {
            type: "video",
            id: "replace-with-lesson-id",
            title: "专题视频解析",
          },
        ],
      },
      null,
      2,
    ),
  }
}

function normalizeFormFromDetail(detail: AdminProductDetailResponse["data"]): ProductFormState {
  return {
    name: detail.name,
    slug: detail.slug ?? "",
    summary: detail.summary ?? "",
    description: detail.description ?? "",
    coverImage: detail.coverImage ?? "",
    type: detail.type,
    status: detail.status,
    currency: detail.currency,
    sortOrder: String(detail.sortOrder),
    tags: detail.tags.join(", "),
    targetType: detail.targetType ?? "",
    targetId: detail.targetId ?? "",
    skuJson: JSON.stringify(detail.skus, null, 2),
    benefitJson: JSON.stringify(detail.benefits, null, 2),
    metadataJson: JSON.stringify(detail.metadata ?? {}, null, 2),
  }
}

function buildPayload(form: ProductFormState): ProductMutationInput {
  const skus = JSON.parse(form.skuJson || "[]")
  const benefits = JSON.parse(form.benefitJson || "[]")
  const metadata = form.metadataJson.trim() ? JSON.parse(form.metadataJson) : null
  const firstSku = Array.isArray(skus) && skus.length > 0 ? skus.find((item) => item.isDefault) ?? skus[0] : null

  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    summary: form.summary.trim() || undefined,
    description: form.description.trim() || undefined,
    coverImage: form.coverImage.trim() || undefined,
    type: form.type,
    status: form.status,
    currency: form.currency,
    priceCents: Number(firstSku?.priceCents ?? 0),
    validDays: firstSku?.validDays != null && firstSku?.validDays !== "" ? Number(firstSku.validDays) : null,
    sortOrder: Number(form.sortOrder || "0"),
    tags: form.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    targetType: form.targetType.trim() || undefined,
    targetId: form.targetId.trim() || undefined,
    metadata,
    skus,
    benefits,
  }
}

export default function AdminStoreProductsPage() {
  const [page, setPage] = React.useState(1)
  const [q, setQ] = React.useState("")
  const [type, setType] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<ProductFormState>(() => createEmptyForm())
  const [submitting, setSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  const { data, mutate, isLoading } = useSWR<AdminProductListResponse>(
    `/admin/store-products?page=${page}&q=${q}&type=${type}&status=${status}`,
    () =>
      api.admin.storeProducts.list<AdminProductListResponse>({
        page: String(page),
        pageSize: "12",
        ...(q ? { q } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      }),
  )

  const setField = React.useCallback(
    (key: keyof ProductFormState, value: string) => {
      setForm((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const resetForm = React.useCallback(() => {
    setEditingId(null)
    setForm(createEmptyForm())
    setErrorMessage("")
    setMessage("")
  }, [])

  const loadDetail = React.useCallback(async (id: string) => {
    setErrorMessage("")
    setMessage("")
    try {
      const detail = await api.admin.storeProducts.get<AdminProductDetailResponse>(id)
      setEditingId(id)
      setForm(normalizeFormFromDetail(detail.data))
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage("加载商品详情失败")
      }
    }
  }, [])

  const submit = React.useCallback(async () => {
    setSubmitting(true)
    setErrorMessage("")
    setMessage("")

    try {
      const payload = buildPayload(form)
      if (editingId) {
        await api.admin.storeProducts.update(editingId, payload)
        setMessage("商品已更新")
      } else {
        await api.admin.storeProducts.create(payload)
        setMessage("商品已创建")
      }
      await mutate()
      resetForm()
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message)
      } else if (error instanceof SyntaxError) {
        setErrorMessage("SKU / 权益 / metadata JSON 解析失败")
      } else {
        setErrorMessage("保存商品失败")
      }
    } finally {
      setSubmitting(false)
    }
  }, [editingId, form, mutate, resetForm])

  return (
    <div className="container space-y-6 px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">商品管理</h1>
          <p className="mt-2 text-muted-foreground">维护会员商品、训练路径商品和内容包商品</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/products">前台商品中心</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin">返回工具页</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{editingId ? "编辑商品" : "创建商品"}</h2>
              <p className="text-sm text-muted-foreground">
                基础字段用表单维护，SKU 与权益先用 JSON 录入，保证数据结构稳定可复用。
              </p>
            </div>
            {editingId ? (
              <Button variant="secondary" onClick={resetForm}>
                切换到新建
              </Button>
            ) : null}
          </div>

          {message ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="商品名称" value={form.name} onChange={(e) => setField("name", e.target.value)} />
            <Input placeholder="slug（可选）" value={form.slug} onChange={(e) => setField("slug", e.target.value)} />
            <Input placeholder="简述" value={form.summary} onChange={(e) => setField("summary", e.target.value)} />
            <Input placeholder="封面图片 URL" value={form.coverImage} onChange={(e) => setField("coverImage", e.target.value)} />
          </div>

          <textarea
            className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="商品详细描述"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
            >
              <option value="membership">membership</option>
              <option value="training_path">training_path</option>
              <option value="content_pack">content_pack</option>
              <option value="video_membership">video_membership</option>
              <option value="camp">camp</option>
              <option value="contest">contest</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="hidden">hidden</option>
            </select>
            <Input placeholder="排序" value={form.sortOrder} onChange={(e) => setField("sortOrder", e.target.value)} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="币种" value={form.currency} onChange={(e) => setField("currency", e.target.value)} />
            <Input placeholder="targetType（可选）" value={form.targetType} onChange={(e) => setField("targetType", e.target.value)} />
            <Input placeholder="targetId（可选）" value={form.targetId} onChange={(e) => setField("targetId", e.target.value)} />
          </div>

          <Input
            placeholder="标签，使用逗号分隔"
            value={form.tags}
            onChange={(e) => setField("tags", e.target.value)}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">SKU JSON</div>
              <textarea
                className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={form.skuJson}
                onChange={(e) => setField("skuJson", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">权益 JSON</div>
              <textarea
                className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={form.benefitJson}
                onChange={(e) => setField("benefitJson", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">metadata JSON</div>
            <textarea
              className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              value={form.metadataJson}
              onChange={(e) => setField("metadataJson", e.target.value)}
            />
            <p className="text-xs leading-6 text-muted-foreground">
              内容包建议在 `includedTargets` 里配置 `training_path / solution / video / problem`。现有购买链路会复用商品主记录，权限中心会读取这些目标做多资源解锁。
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "保存中..." : editingId ? "更新商品" : "创建商品"}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">商品列表</h2>
              <div className="text-sm text-muted-foreground">
                共 {data?.meta.total ?? 0} 个商品，第 {data?.meta.page ?? 1} / {Math.max(data?.meta.totalPages ?? 1, 1)} 页
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="搜索商品" value={q} onChange={(e) => setQ(e.target.value)} className="w-[180px]" />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">全部类型</option>
                <option value="membership">membership</option>
                <option value="training_path">training_path</option>
                <option value="content_pack">content_pack</option>
                <option value="video_membership">video_membership</option>
                <option value="camp">camp</option>
                <option value="contest">contest</option>
              </select>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">全部状态</option>
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="hidden">hidden</option>
              </select>
            </div>
          </div>

          {isLoading && !data ? <div className="text-sm text-muted-foreground">商品列表加载中...</div> : null}

          <div className="grid gap-4">
            {data?.data.map((product) => (
              <div key={product.id} className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold text-foreground">{product.name}</div>
                      <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {getProductTypeLabel(product.type)}
                      </div>
                      <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {product.status}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product.summary || product.description || "暂无简介"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      SKU {product.skuCount} 个 · 订单 {product.orderCount} · 权益 {product.entitlementCount}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => loadDetail(product.id)}>
                      编辑
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href={`/products/${product.id}`}>查看</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              上一页
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(data && data.meta.totalPages > 0 && page >= data.meta.totalPages)}
              onClick={() => setPage((value) => value + 1)}
            >
              下一页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
