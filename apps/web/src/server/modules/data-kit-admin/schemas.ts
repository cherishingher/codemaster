import { z } from "zod"

const ParamValueSchema = z
  .string()
  .trim()
  .max(200, "参数值过长")
  .refine((value) => !/[\r\n]/.test(value), "参数值不能包含换行")

const ParamsSchema = z
  .record(z.string().regex(/^[a-zA-Z0-9_]+$/, "参数名只允许字母、数字和下划线"), ParamValueSchema)
  .default({})
  .refine((value) => Object.keys(value).length <= 20, "单次最多传 20 个参数")

export const DataKitGenerateSchema = z.object({
  tool: z.string().min(1, "请选择生成器"),
  params: ParamsSchema,
})

export const DataKitValidateSchema = z.object({
  tool: z.string().min(1, "请选择校验器"),
  params: ParamsSchema,
  input: z.string().max(500_000, "校验输入过大，当前工作台只支持 500KB 以内预览"),
})
