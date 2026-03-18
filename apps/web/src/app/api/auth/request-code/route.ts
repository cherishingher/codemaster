import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { randomInt } from "crypto"
import { db } from "@/lib/db"
import { hashVerificationCode, normalizeIdentifier } from "@/lib/verification"

export const runtime = "nodejs"

const RequestSchema = z.object({
  identifier: z.string().min(3),
  purpose: z.enum(["register", "reset_password"]).optional(),
})

const CODE_TTL_MINUTES = 10
const RATE_LIMIT_SECONDS = 60
const IP_RATE_LIMIT_PER_HOUR = 20

type AliyunSendResult = {
  ok: boolean
  requestId?: string
  message?: string
}

type AliyunApiResponse = Record<string, unknown>

type AliyunClient = {
  request: (
    action: string,
    params: Record<string, unknown>,
    options: { method: "POST" }
  ) => Promise<AliyunApiResponse>
}

function getResponseString(result: AliyunApiResponse, ...keys: string[]) {
  for (const key of keys) {
    const value = result[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return undefined
}

function toSendError(result: AliyunApiResponse, fallback: string): AliyunSendResult {
  return {
    ok: false,
    requestId: getResponseString(result, "RequestId"),
    message: getResponseString(result, "Message", "ResponseDescription") ?? fallback,
  }
}

async function createAliyunClient(endpoint: string, apiVersion: string): Promise<AliyunClient | null> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET
  if (!accessKeyId || !accessKeySecret) return null
  const { default: Core } = (await import("@alicloud/pop-core")) as { default: any }
  return new Core({ accessKeyId, accessKeySecret, endpoint, apiVersion })
}

async function sendAliyunSms(phone: string, code: string): Promise<AliyunSendResult> {
  const signName = process.env.ALIYUN_SMS_SIGN_NAME
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE
  if (!signName || !templateCode) {
    return { ok: false, message: "sms_not_configured" }
  }
  const client = await createAliyunClient("dysmsapi.aliyuncs.com", "2017-05-25")
  if (!client) {
    return { ok: false, message: "aliyun_credentials_missing" }
  }
  const params: Record<string, unknown> = {
    PhoneNumbers: phone.startsWith("+") ? phone.slice(1) : phone,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
  }
  if (process.env.ALIYUN_REGION_ID) {
    params.RegionId = process.env.ALIYUN_REGION_ID
  }
  const result = await client.request("SendSms", params, { method: "POST" })
  const responseCode = getResponseString(result, "Code", "ResponseCode")
  if (responseCode && responseCode !== "OK") {
    return toSendError(result, "SendSms failed")
  }
  return { ok: true, requestId: getResponseString(result, "RequestId") }
}

async function sendAliyunEmail(email: string, code: string): Promise<AliyunSendResult> {
  const accountName = process.env.ALIYUN_DM_ACCOUNT_NAME
  if (!accountName) {
    return { ok: false, message: "dm_not_configured" }
  }
  const client = await createAliyunClient("dm.aliyuncs.com", "2015-11-23")
  if (!client) {
    return { ok: false, message: "aliyun_credentials_missing" }
  }

  const params: Record<string, unknown> = {
    AccountName: accountName,
    AddressType: 1,
    ReplyToAddress: "true",
    ToAddress: email,
  }
  if (process.env.ALIYUN_DM_FROM_ALIAS) {
    params.FromAlias = process.env.ALIYUN_DM_FROM_ALIAS
  }
  if (process.env.ALIYUN_DM_TAG_NAME) {
    params.TagName = process.env.ALIYUN_DM_TAG_NAME
  }
  if (process.env.ALIYUN_REGION_ID) {
    params.RegionId = process.env.ALIYUN_REGION_ID
  }
  params.Subject = process.env.ALIYUN_DM_SUBJECT ?? "验证码"
  params.HtmlBody = `<p>您的验证码是 <strong>${code}</strong> ，10 分钟内有效。</p>`

  const result = await client.request("SingleSendMail", params, { method: "POST" })
  const responseCode = getResponseString(result, "Code", "ResponseCode")
  if (responseCode && responseCode !== "OK") {
    return toSendError(result, "SingleSendMail failed")
  }
  return { ok: true, requestId: getResponseString(result, "RequestId") }
}

export async function POST(req: NextRequest) {
  const payload = RequestSchema.safeParse(await req.json())
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const identifier = payload.data.identifier
  const purpose = payload.data.purpose ?? "register"
  const normalized = normalizeIdentifier(identifier)
  if (!normalized) {
    return NextResponse.json({ error: "invalid_identifier" }, { status: 400 })
  }

  const { type, target } = normalized

  const existing = await db.user.findFirst({
    where: type === "email" ? { email: target } : { phone: target },
    select: { id: true },
  })
  if (purpose === "register" && existing) {
    return NextResponse.json({ error: "request_accepted", ok: true, target, type, expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000), delivery: null })
  }
  if (purpose === "reset_password" && !existing) {
    return NextResponse.json({ error: "request_accepted", ok: true, target, type, expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000), delivery: null })
  }

  const latest = await db.verificationCode.findFirst({
    where: { target, type, purpose },
    orderBy: { createdAt: "desc" },
  })
  if (latest) {
    const secondsSince = (Date.now() - latest.createdAt.getTime()) / 1000
    if (secondsSince < RATE_LIMIT_SECONDS) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: Math.ceil(RATE_LIMIT_SECONDS - secondsSince) },
        { status: 429 }
      )
    }
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const ipCount = await db.verificationCode.count({
      where: { ip, createdAt: { gt: oneHourAgo } },
    })
    if (ipCount >= IP_RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "too_many_requests", message: "请求过于频繁，请稍后再试" },
        { status: 429 }
      )
    }
  }

  const code = randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
  const debug = process.env.NODE_ENV !== "production" && process.env.DEBUG_AUTH_CODES === "true"

  let delivery: AliyunSendResult | null = null
  try {
    if (type === "phone") {
      delivery = await sendAliyunSms(target, code)
    } else {
      delivery = await sendAliyunEmail(target, code)
    }
    if (!delivery.ok) {
      console.error("[auth] verification delivery failed", {
        type,
        target,
        message: delivery.message,
        requestId: delivery.requestId,
      })
    }
    if (!delivery.ok && !debug) {
      return NextResponse.json(
        { error: "send_failed", message: "验证码发送失败，请稍后重试" },
        { status: 500 }
      )
    }
  } catch (err) {
    console.error("[auth] send verification code failed", err)
    if (!debug) {
      return NextResponse.json(
        { error: "send_failed", message: "验证码发送失败，请稍后重试" },
        { status: 500 }
      )
    }
  }

  await db.verificationCode.create({
    data: {
      target,
      type,
      purpose,
      codeHash: hashVerificationCode(code, target),
      expiresAt,
      ip,
    },
  })

  if (debug) {
    console.log(`[auth] DEBUG verification code sent to ${type}:${target}`)
  }

  return NextResponse.json({
    ok: true,
    target,
    type,
    expiresAt,
    delivery: delivery ? { ok: delivery.ok, requestId: delivery.requestId } : null,
    ...(debug ? { debugCode: code } : {}),
  })
}
