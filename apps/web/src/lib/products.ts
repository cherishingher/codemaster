export type ProductType = "membership" | "training_path" | "content_pack" | "video_membership" | "camp" | "contest" | string

export type ProductSkuView = {
  id: string
  skuCode: string
  name: string
  description?: string | null
  priceCents: number
  originalPriceCents?: number | null
  currency: string
  validDays?: number | null
  status: string
  isDefault: boolean
  sortOrder: number
}

export type ProductBenefitView = {
  id: string
  title: string
  description?: string | null
  benefitType: string
  sortOrder: number
}

export type ProductListItem = {
  id: string
  slug?: string | null
  name: string
  summary?: string | null
  description?: string | null
  coverImage?: string | null
  type: string
  status: string
  currency: string
  tags: string[]
  targetType?: string | null
  targetId?: string | null
  sortOrder: number
  defaultSku: ProductSkuView
  skuCount: number
  benefits: ProductBenefitView[]
  createdAt: string
  updatedAt: string
}

export type ProductDetailItem = ProductListItem & {
  skus: ProductSkuView[]
  metadata?: Record<string, unknown> | null
}

export type PaginationMeta = {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ProductListResponse = {
  data: ProductListItem[]
  meta: PaginationMeta
}

export type ProductDetailResponse = {
  data: ProductDetailItem
}

export type UserAssetItem = {
  product: ProductListItem
  isActive: boolean
  paidOrderCount: number
  lastPaidAt?: string | null
  entitlementGrantedAt?: string | null
  entitlementExpiresAt?: string | null
}

export type UserAssetsResponse = {
  data: {
    items: UserAssetItem[]
    summary: {
      totalAssetCount: number
      activeAssetCount: number
      paidOrderCount: number
    }
  }
}

export type AdminProductListItem = ProductListItem & {
  orderCount: number
  entitlementCount: number
}

export type AdminProductListResponse = {
  data: AdminProductListItem[]
  meta: PaginationMeta
}

export type AdminProductDetailResponse = {
  data: AdminProductListItem & {
    skus: ProductSkuView[]
    metadata?: Record<string, unknown> | null
  }
}

export type ProductSkuInput = {
  id?: string
  skuCode?: string
  name: string
  description?: string
  priceCents: number
  originalPriceCents?: number | null
  currency?: string
  validDays?: number | null
  status?: string
  isDefault?: boolean
  sortOrder?: number
}

export type ProductBenefitInput = {
  id?: string
  title: string
  description?: string
  benefitType?: string
  sortOrder?: number
}

export type ProductMutationInput = {
  name: string
  slug?: string
  summary?: string
  description?: string
  coverImage?: string
  type: string
  status?: string
  currency?: string
  priceCents: number
  validDays?: number | null
  sortOrder?: number
  tags?: string[]
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown> | null
  skus: ProductSkuInput[]
  benefits?: ProductBenefitInput[]
}

export function formatPriceCents(priceCents: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(priceCents / 100)
}

export function getProductTypeLabel(type: string) {
  switch (type) {
    case "membership":
    case "video_membership":
      return "会员商品"
    case "training_path":
      return "训练路径"
    case "content_pack":
      return "内容包"
    case "camp":
      return "训练营"
    case "contest":
      return "模拟赛"
    default:
      return type
  }
}
