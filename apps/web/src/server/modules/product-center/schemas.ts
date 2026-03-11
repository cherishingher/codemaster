import { z } from "zod"

const ProductStatusSchema = z.enum(["draft", "active", "inactive", "hidden"]).default("active")

const OptionalStringSchema = z.string().trim().max(5000).optional()

export const ProductListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
})

export const AdminProductListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.string().trim().max(64).optional(),
  status: z.string().trim().max(32).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const ProductSkuInputSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  skuCode: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(120),
  description: OptionalStringSchema,
  priceCents: z.number().int().min(0).max(10_000_000),
  originalPriceCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  currency: z.string().trim().min(1).max(8).default("CNY"),
  validDays: z.number().int().min(1).max(3650).nullable().optional(),
  status: ProductStatusSchema,
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
})

export const ProductBenefitInputSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(120),
  description: OptionalStringSchema,
  benefitType: z.string().trim().min(1).max(32).optional().default("text"),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
})

export const ProductMutationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(160).optional(),
  summary: z.string().trim().max(280).optional(),
  description: OptionalStringSchema,
  coverImage: z.string().trim().url().max(1000).optional(),
  type: z.string().trim().min(1).max(64),
  status: ProductStatusSchema,
  currency: z.string().trim().min(1).max(8).default("CNY"),
  priceCents: z.number().int().min(0).max(10_000_000),
  validDays: z.number().int().min(1).max(3650).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional().default([]),
  targetType: z.string().trim().max(64).optional(),
  targetId: z.string().trim().max(64).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  skus: z.array(ProductSkuInputSchema).min(1).max(12),
  benefits: z.array(ProductBenefitInputSchema).max(20).optional().default([]),
})

export type ProductListQuery = z.infer<typeof ProductListQuerySchema>
export type AdminProductListQuery = z.infer<typeof AdminProductListQuerySchema>
export type ProductMutationPayload = z.infer<typeof ProductMutationSchema>
