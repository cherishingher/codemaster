import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type {
  AdminProductDetailResponse,
  AdminProductListItem,
  PaginationMeta,
  ProductBenefitView,
  ProductDetailItem,
  ProductListItem,
  ProductMutationInput,
  ProductSkuView,
  UserAssetItem,
} from "@/lib/products"
import type {
  AdminProductListQuery,
  ProductListQuery,
} from "@/server/modules/product-center/schemas"

export class ProductCenterError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

const publicProductArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    skus: {
      where: { status: "active" },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    },
    benefits: {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    },
  },
})

const adminProductArgs = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    skus: {
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    },
    benefits: {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    },
    _count: {
      select: {
        orders: true,
        entitlements: true,
      },
    },
  },
})

type ProductWithPublicRelations = Prisma.ProductGetPayload<typeof publicProductArgs>
type ProductWithAdminRelations = Prisma.ProductGetPayload<typeof adminProductArgs>

type PreparedSkuInput = {
  id?: string
  skuCode: string
  name: string
  description?: string
  priceCents: number
  originalPriceCents?: number | null
  currency: string
  validDays?: number | null
  status: string
  isDefault: boolean
  sortOrder: number
}

type PreparedBenefitInput = {
  id?: string
  title: string
  description?: string
  benefitType: string
  sortOrder: number
}

function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return {
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  }
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function slugify(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return normalized
}

async function buildUniqueSlug(
  tx: Prisma.TransactionClient,
  input: string,
  excludeProductId?: string,
) {
  const seed = slugify(input) || `product-${Date.now().toString(36)}`

  let candidate = seed
  let suffix = 1

  while (true) {
    const existing = await tx.product.findFirst({
      where: {
        slug: candidate,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }

    suffix += 1
    candidate = `${seed}-${suffix}`
  }
}

function buildSkuCode(seed: string, index: number) {
  const normalized = slugify(seed)
  return normalized || `sku-${index + 1}`
}

function mapSkuFallback(product: {
  id: string
  name: string
  priceCents: number
  validDays: number | null
  currency: string
}): ProductSkuView {
  return {
    id: `virtual:${product.id}`,
    skuCode: "default",
    name: `${product.name} 标准版`,
    description: null,
    priceCents: product.priceCents,
    originalPriceCents: null,
    currency: product.currency,
    validDays: product.validDays,
    status: "active",
    isDefault: true,
    sortOrder: 0,
  }
}

function mapSku(sku: ProductWithPublicRelations["skus"][number]): ProductSkuView {
  return {
    id: sku.id,
    skuCode: sku.skuCode,
    name: sku.name,
    description: sku.description,
    priceCents: sku.priceCents,
    originalPriceCents: sku.originalPriceCents,
    currency: sku.currency,
    validDays: sku.validDays,
    status: sku.status,
    isDefault: sku.isDefault,
    sortOrder: sku.sortOrder,
  }
}

function mapBenefit(benefit: ProductWithPublicRelations["benefits"][number]): ProductBenefitView {
  return {
    id: benefit.id,
    title: benefit.title,
    description: benefit.description,
    benefitType: benefit.benefitType,
    sortOrder: benefit.sortOrder,
  }
}

function pickDefaultSku(product: ProductWithPublicRelations) {
  if (product.skus.length === 0) {
    return mapSkuFallback(product)
  }

  return mapSku(product.skus.find((item) => item.isDefault) ?? product.skus[0])
}

function mapProductListItem(product: ProductWithPublicRelations): ProductListItem {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    description: product.description,
    coverImage: product.coverImage,
    type: product.type,
    status: product.status,
    currency: product.currency,
    tags: normalizeTags(product.tags),
    targetType: product.targetType,
    targetId: product.targetId,
    sortOrder: product.sortOrder,
    defaultSku: pickDefaultSku(product),
    skuCount: product.skus.length > 0 ? product.skus.length : 1,
    benefits: product.benefits.map(mapBenefit),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

function mapProductDetailItem(product: ProductWithPublicRelations): ProductDetailItem {
  return {
    ...mapProductListItem(product),
    skus: product.skus.length > 0 ? product.skus.map(mapSku) : [mapSkuFallback(product)],
    metadata: normalizeMetadata(product.metadata),
  }
}

function mapAdminProductListItem(product: ProductWithAdminRelations): AdminProductListItem {
  return {
    ...mapProductListItem(product),
    orderCount: product._count.orders,
    entitlementCount: product._count.entitlements,
  }
}

function buildPublicWhere(filters: ProductListQuery): Prisma.ProductWhereInput {
  return {
    status: "active",
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { summary: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  }
}

function buildAdminWhere(filters: AdminProductListQuery): Prisma.ProductWhereInput {
  return {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { summary: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  }
}

function prepareSkuInputs(
  skus: ProductMutationInput["skus"],
  fallbackCurrency: string,
): PreparedSkuInput[] {
  const normalized = skus.map((sku, index) => ({
    ...sku,
    skuCode: sku.skuCode?.trim() || buildSkuCode(sku.name, index),
    currency: sku.currency?.trim() || fallbackCurrency,
    status: sku.status ?? "active",
    sortOrder: sku.sortOrder ?? index,
    isDefault: Boolean(sku.isDefault),
  }))

  const seen = new Set<string>()
  normalized.forEach((sku) => {
    if (seen.has(sku.skuCode ?? "")) {
      throw new ProductCenterError("duplicate_sku_code", `SKU 编码重复：${sku.skuCode}`, 409)
    }
    seen.add(sku.skuCode ?? "")
  })

  const firstDefaultIndex = normalized.findIndex((item) => item.isDefault)
  normalized.forEach((sku, index) => {
    sku.isDefault = firstDefaultIndex === -1 ? index === 0 : index === firstDefaultIndex
    if (sku.originalPriceCents != null && sku.originalPriceCents < sku.priceCents) {
      sku.originalPriceCents = sku.priceCents
    }
  })

  return normalized
}

function prepareBenefits(
  benefits: NonNullable<ProductMutationInput["benefits"]>,
): PreparedBenefitInput[] {
  return benefits.map((benefit, index) => ({
    ...benefit,
    benefitType: benefit.benefitType ?? "text",
    sortOrder: benefit.sortOrder ?? index,
  }))
}

async function syncProductSkus(
  tx: Prisma.TransactionClient,
  productId: string,
  skus: PreparedSkuInput[],
) {
  const existing = await tx.productSku.findMany({
    where: { productId },
    select: { id: true },
  })

  const existingIds = new Set(existing.map((item) => item.id))
  const keepIds: string[] = []

  for (const sku of skus) {
    if (sku.id && existingIds.has(sku.id)) {
      const updated = await tx.productSku.update({
        where: { id: sku.id },
        data: {
          skuCode: sku.skuCode,
          name: sku.name,
          description: sku.description,
          priceCents: sku.priceCents,
          originalPriceCents: sku.originalPriceCents ?? null,
          currency: sku.currency,
          validDays: sku.validDays ?? null,
          status: sku.status,
          isDefault: Boolean(sku.isDefault),
          sortOrder: sku.sortOrder ?? 0,
        },
      })
      keepIds.push(updated.id)
      continue
    }

    const created = await tx.productSku.create({
      data: {
        productId,
        skuCode: sku.skuCode!,
        name: sku.name,
        description: sku.description,
        priceCents: sku.priceCents,
        originalPriceCents: sku.originalPriceCents ?? null,
        currency: sku.currency ?? "CNY",
        validDays: sku.validDays ?? null,
        status: sku.status ?? "active",
        isDefault: Boolean(sku.isDefault),
        sortOrder: sku.sortOrder ?? 0,
      },
    })
    keepIds.push(created.id)
  }

  await tx.productSku.deleteMany({
    where: {
      productId,
      ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
    },
  })
}

async function syncProductBenefits(
  tx: Prisma.TransactionClient,
  productId: string,
  benefits: PreparedBenefitInput[],
) {
  const existing = await tx.productBenefit.findMany({
    where: { productId },
    select: { id: true },
  })

  const existingIds = new Set(existing.map((item) => item.id))
  const keepIds: string[] = []

  for (const benefit of benefits) {
    if (benefit.id && existingIds.has(benefit.id)) {
      const updated = await tx.productBenefit.update({
        where: { id: benefit.id },
        data: {
          title: benefit.title,
          description: benefit.description,
          benefitType: benefit.benefitType ?? "text",
          sortOrder: benefit.sortOrder ?? 0,
        },
      })
      keepIds.push(updated.id)
      continue
    }

    const created = await tx.productBenefit.create({
      data: {
        productId,
        title: benefit.title,
        description: benefit.description,
        benefitType: benefit.benefitType ?? "text",
        sortOrder: benefit.sortOrder ?? 0,
      },
    })
    keepIds.push(created.id)
  }

  await tx.productBenefit.deleteMany({
    where: {
      productId,
      ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
    },
  })
}

async function loadAdminProductById(
  tx: Prisma.TransactionClient | typeof db,
  id: string,
) {
  return tx.product.findUnique({
    where: { id },
    ...adminProductArgs,
  })
}

export async function listPublicProducts(filters: ProductListQuery) {
  const where = buildPublicWhere(filters)
  const skip = (filters.page - 1) * filters.pageSize

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      ...publicProductArgs,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: filters.pageSize,
    }),
  ])

  return {
    data: products.map(mapProductListItem),
    meta: buildPaginationMeta(total, filters.page, filters.pageSize),
  }
}

export async function getPublicProductDetail(idOrSlug: string) {
  const product = await db.product.findFirst({
    where: {
      status: "active",
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    ...publicProductArgs,
  })

  if (!product) {
    throw new ProductCenterError("not_found", "商品不存在", 404)
  }

  return mapProductDetailItem(product)
}

export async function listUserAssets(userId: string) {
  const [entitlements, orders] = await Promise.all([
    db.entitlement.findMany({
      where: {
        userId,
      },
      include: {
        product: {
          ...publicProductArgs,
        },
      },
      orderBy: { grantedAt: "desc" },
    }),
    db.order.findMany({
      where: {
        userId,
        status: { in: ["PAID", "COMPLETED"] },
        productId: { not: null },
      },
      include: {
        product: {
          ...publicProductArgs,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const now = new Date()
  const byProductId = new Map<string, UserAssetItem>()

  for (const entitlement of entitlements) {
    const product = entitlement.product
    const isActive = entitlement.expiresAt == null || entitlement.expiresAt > now
    const current = byProductId.get(product.id)

    byProductId.set(product.id, {
      product: mapProductListItem(product),
      isActive,
      paidOrderCount: current?.paidOrderCount ?? 0,
      lastPaidAt: current?.lastPaidAt ?? null,
      entitlementGrantedAt: entitlement.grantedAt.toISOString(),
      entitlementExpiresAt: entitlement.expiresAt?.toISOString() ?? null,
    })
  }

  for (const order of orders) {
    if (!order.product) continue
    const current = byProductId.get(order.product.id)

    byProductId.set(order.product.id, {
      product: current?.product ?? mapProductListItem(order.product),
      isActive: current?.isActive ?? false,
      paidOrderCount: (current?.paidOrderCount ?? 0) + 1,
      lastPaidAt: current?.lastPaidAt ?? (order.paidAt ?? order.createdAt).toISOString(),
      entitlementGrantedAt: current?.entitlementGrantedAt ?? null,
      entitlementExpiresAt: current?.entitlementExpiresAt ?? null,
    })
  }

  const items = Array.from(byProductId.values()).sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
    return (right.lastPaidAt ?? "").localeCompare(left.lastPaidAt ?? "")
  })

  return {
    items,
    summary: {
      totalAssetCount: items.length,
      activeAssetCount: items.filter((item) => item.isActive).length,
      paidOrderCount: items.reduce((sum, item) => sum + item.paidOrderCount, 0),
    },
  }
}

export async function listAdminProducts(filters: AdminProductListQuery) {
  const where = buildAdminWhere(filters)
  const skip = (filters.page - 1) * filters.pageSize

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      ...adminProductArgs,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: filters.pageSize,
    }),
  ])

  return {
    data: products.map(mapAdminProductListItem),
    meta: buildPaginationMeta(total, filters.page, filters.pageSize),
  }
}

export async function getAdminProductDetail(id: string): Promise<AdminProductDetailResponse["data"]> {
  const product = await db.product.findUnique({
    where: { id },
    ...adminProductArgs,
  })

  if (!product) {
    throw new ProductCenterError("not_found", "商品不存在", 404)
  }

  return {
    ...mapAdminProductListItem(product),
    skus: product.skus.length > 0 ? product.skus.map(mapSku) : [mapSkuFallback(product)],
    metadata: normalizeMetadata(product.metadata),
  }
}

export async function createProduct(input: ProductMutationInput) {
  return db.$transaction(async (tx) => {
    const skus = prepareSkuInputs(input.skus, input.currency ?? "CNY")
    const benefits = prepareBenefits(input.benefits ?? [])
    const primarySku = skus.find((item) => item.isDefault) ?? skus[0]
    const slug = await buildUniqueSlug(tx, input.slug || input.name)

    const product = await tx.product.create({
      data: {
        slug,
        name: input.name,
        summary: input.summary,
        description: input.description,
        coverImage: input.coverImage,
        type: input.type,
        status: input.status ?? "active",
        priceCents: primarySku.priceCents,
        currency: primarySku.currency ?? input.currency ?? "CNY",
        validDays: primarySku.validDays ?? input.validDays ?? null,
        sortOrder: input.sortOrder ?? 0,
        tags:
          input.tags && input.tags.length > 0
            ? (input.tags as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    await syncProductSkus(tx, product.id, skus)
    await syncProductBenefits(tx, product.id, benefits)

    const created = await loadAdminProductById(tx, product.id)
    if (!created) {
      throw new ProductCenterError("create_failed", "商品创建失败", 500)
    }

    return {
      ...mapAdminProductListItem(created),
      skus: created.skus.length > 0 ? created.skus.map(mapSku) : [mapSkuFallback(created)],
      metadata: normalizeMetadata(created.metadata),
    }
  })
}

export async function updateProduct(id: string, input: ProductMutationInput) {
  return db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new ProductCenterError("not_found", "商品不存在", 404)
    }

    const skus = prepareSkuInputs(input.skus, input.currency ?? "CNY")
    const benefits = prepareBenefits(input.benefits ?? [])
    const primarySku = skus.find((item) => item.isDefault) ?? skus[0]
    const slug = await buildUniqueSlug(tx, input.slug || input.name, id)

    await tx.product.update({
      where: { id },
      data: {
        slug,
        name: input.name,
        summary: input.summary,
        description: input.description,
        coverImage: input.coverImage,
        type: input.type,
        status: input.status ?? "active",
        priceCents: primarySku.priceCents,
        currency: primarySku.currency ?? input.currency ?? "CNY",
        validDays: primarySku.validDays ?? input.validDays ?? null,
        sortOrder: input.sortOrder ?? 0,
        tags:
          input.tags && input.tags.length > 0
            ? (input.tags as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    await syncProductSkus(tx, id, skus)
    await syncProductBenefits(tx, id, benefits)

    const updated = await loadAdminProductById(tx, id)
    if (!updated) {
      throw new ProductCenterError("update_failed", "商品更新失败", 500)
    }

    return {
      ...mapAdminProductListItem(updated),
      skus: updated.skus.length > 0 ? updated.skus.map(mapSku) : [mapSkuFallback(updated)],
      metadata: normalizeMetadata(updated.metadata),
    }
  })
}
