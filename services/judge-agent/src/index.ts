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

async function main() {
  for (const stream of STREAMS) {
    await ensureGroup(stream)
  }

  while (true) {
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
      for (const [id, fields] of messages) {
        const payloadIndex = fields.findIndex((value: string) => value === "payload")
        const payloadRaw = payloadIndex >= 0 ? fields[payloadIndex + 1] : "{}"
        let payload: unknown = {}
        let submissionId: string | null = null

        try {
          payload = JSON.parse(payloadRaw)
          if (
            stream === "judge:jobs" &&
            payload &&
            typeof payload === "object" &&
            "submissionId" in payload &&
            typeof (payload as { submissionId?: unknown }).submissionId === "string"
          ) {
            submissionId = (payload as { submissionId: string }).submissionId
          }

          await handleMessage(stream, payload)
        } catch (error) {
          console.error("job failed", stream, error)
          if (stream === "judge:jobs" && submissionId) {
            try {
              await reportJudgeResult(
                env.API_BASE_URL,
                env.JUDGE_CALLBACK_SECRET,
                submissionId,
                "SYSTEM_ERROR",
                0,
                []
              )
            } catch (reportError) {
              console.error("report system error failed", reportError)
            }
          }
        } finally {
          try {
            await redis.xack(stream, GROUP, id)
          } catch (ackError) {
            console.error("xack failed", ackError)
          }
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
