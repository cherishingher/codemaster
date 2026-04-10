import { Redis } from "ioredis"
import { z } from "zod"
import { handleJudgeJob, reportJudgeResult } from "./jobs/judge.js"
import { handleTestdataGenerationJob } from "./jobs/testdata-generation.js"

const envSchema = z.object({
  REDIS_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  JUDGE_CALLBACK_SECRET: z.string().min(1),
  JUDGE_ID: z.string().optional(),
})

const env = envSchema.parse(process.env)
const redis = new Redis(env.REDIS_URL)

const GROUP = "judge-agents"
const CONSUMER = env.JUDGE_ID ?? `judge-${Math.random().toString(36).slice(2, 8)}`
const STREAMS = ["judge:jobs", "testgen:jobs"] as const
const JUDGE_STREAM = "judge:jobs"
const PENDING_IDLE_MS = 5_000
const PENDING_BATCH_SIZE = 10

async function ensureGroup(stream: string) {
  try {
    await redis.xgroup("CREATE", stream, GROUP, "$", "MKSTREAM")
  } catch (error: any) {
    if (!String(error?.message ?? "").includes("BUSYGROUP")) {
      throw error
    }
  }
}

async function handleMessage(stream: string, payload: unknown) {
  if (stream === "testgen:jobs") {
    await handleTestdataGenerationJob(payload, CONSUMER)
    return
  }

  await handleJudgeJob(payload, {
    apiBaseUrl: env.API_BASE_URL,
    callbackSecret: env.JUDGE_CALLBACK_SECRET,
  })
}

async function claimPendingJudgeMessages() {
  const claimed = (await (redis as any).xautoclaim(
    JUDGE_STREAM,
    GROUP,
    CONSUMER,
    String(PENDING_IDLE_MS),
    "0-0",
    "COUNT",
    String(PENDING_BATCH_SIZE)
  )) as [string, [string, string[]][], string[]?] | null

  if (!claimed || !Array.isArray(claimed[1])) {
    return [] as [string, string[]][]
  }

  return claimed[1] as [string, string[]][]
}

async function processMessage(stream: string, id: string, fields: string[]) {
  const payloadIndex = fields.findIndex((value: string) => value === "payload")
  const payloadRaw = payloadIndex >= 0 ? fields[payloadIndex + 1] : "{}"
  let payload: unknown = {}
  let submissionId: string | null = null
  let shouldAck = false

  try {
    payload = JSON.parse(payloadRaw)
    if (
      stream === JUDGE_STREAM &&
      payload &&
      typeof payload === "object" &&
      "submissionId" in payload &&
      typeof (payload as { submissionId?: unknown }).submissionId === "string"
    ) {
      submissionId = (payload as { submissionId: string }).submissionId
    }

    await handleMessage(stream, payload)
    shouldAck = true
  } catch (error) {
    console.error("job failed", stream, error)

    if (stream !== JUDGE_STREAM || !submissionId) {
      shouldAck = true
    } else {
      try {
        await reportJudgeResult(
          env.API_BASE_URL,
          env.JUDGE_CALLBACK_SECRET,
          submissionId,
          "SYSTEM_ERROR",
          0,
          []
        )
        shouldAck = true
      } catch (reportError) {
        console.error("report system error failed", reportError)
      }
    }
  }

  if (!shouldAck) {
    console.warn("message left pending for retry", { stream, id, submissionId })
    return
  }

  try {
    await redis.xack(stream, GROUP, id)
  } catch (ackError) {
    console.error("xack failed", ackError)
  }
}

async function processMessages(stream: string, messages: [string, string[]][]) {
  for (const [id, fields] of messages) {
    await processMessage(stream, id, fields)
  }
}

async function main() {
  for (const stream of STREAMS) {
    await ensureGroup(stream)
  }

  while (true) {
    const pendingJudgeMessages = await claimPendingJudgeMessages()
    if (pendingJudgeMessages.length > 0) {
      await processMessages(JUDGE_STREAM, pendingJudgeMessages)
    }

    const response = (await (redis as any).xreadgroup(
      "GROUP",
      GROUP,
      CONSUMER,
      "BLOCK",
      "2000",
      "COUNT",
      "1",
      "STREAMS",
      ...STREAMS,
      ...STREAMS.map(() => ">")
    )) as [string, [string, string[]][]][] | null

    if (!response) continue

    for (const [stream, messages] of response) {
      await processMessages(stream, messages)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
