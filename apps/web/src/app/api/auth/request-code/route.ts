import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { hashVerificationCode, normalizeIdentifier } from "@/lib/verification"

export const runtime = "nodejs"

const RequestSchema = z.object({
  identifier: z.string().min(3),
  purpose: z.string().optional(),
})

const CODE_TTL_MINUTES = 10
const RATE_LIMIT_SECONDS = 60

type AliyunSendResult = {
  ok: boolean
  requestId?: string
  message?: string
}

async function createAliyunClient(endpoint: string, apiVersion: string) {
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
    To: phone,
    From: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code }),
  }
  if (process.env.ALIYUN_REGION_ID) {
    params.RegionId = process.env.ALIYUN_REGION_ID
  }
  const result = await client.request("SendMessageWithTemplate", params, { method: "POST" })
  const responseCode = result?.ResponseCode ?? result?.Code
  if (responseCode && responseCode !== "OK") {
    return {
      ok: false,
      message: result.ResponseDescription ?? result.Message ?? "SendMessageWithTemplate failed",
      requestId: result.RequestId,
    }
  }
  return { ok: true, requestId: result?.RequestId }
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
  params.HtmlBody = `<div style="font-size:14px">您的验证码是 <strong>${code}</strong>，10 分钟内有效。</div>`

  const result = await client.request("SingleSendMail", params, { method: "POST" })
  return { ok: true, requestId: result?.RequestId }
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
  if (existing) {
    return NextResponse.json({ error: "user_exists" }, { status: 409 })
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

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  const debug = process.env.DEBUG_AUTH_CODES === "true" || process.env.NODE_ENV !== "production"

  let delivery: AliyunSendResult | null = null
  try {
    if (type === "phone") {
      delivery = await sendAliyunSms(target, code)
    } else {
      delivery = await sendAliyunEmail(target, code)
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
    console.log(`[auth] verification code for ${type}:${target} -> ${code}`)
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
