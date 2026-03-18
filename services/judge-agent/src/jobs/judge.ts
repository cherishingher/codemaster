import { readFile, rm, writeFile, mkdtemp } from "fs/promises"
import path from "path"
import { tmpdir } from "os"
import { z } from "zod"
import { loadCode, normalizeOutput, readTextUri, runCommand } from "../lib/process.js"

export const JudgeJobSchema = z.object({
  jobId: z.string(),
  submissionId: z.string(),
  problemId: z.string(),
  problemVersionId: z.string().optional(),
  language: z.string(),
  code: z.string().optional(),
  codeUri: z.string().optional(),
  timeLimitMs: z.number().int().positive().optional(),
  memoryLimitMb: z.number().int().positive().optional(),
  testcases: z
    .array(
      z.object({
        testcaseId: z.string().optional(),
        inputUri: z.string(),
        outputUri: z.string(),
        score: z.number().int().min(0),
      })
    )
    .optional(),
})

type CaseResult = {
  testcaseId?: string
  status: string
  timeMs: number
  memoryMb: number
  score: number
}

export async function reportJudgeResult(
  apiBaseUrl: string,
  callbackSecret: string,
  submissionId: string,
  status: string,
  score: number,
  cases: CaseResult[]
) {
  const response = await fetch(`${apiBaseUrl}/api/judge/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-judge-secret": callbackSecret,
    },
    body: JSON.stringify({
      submissionId,
      status,
      score,
      cases,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`callback_failed:${response.status}:${text}`)
  }
}

export async function handleJudgeJob(
  payload: unknown,
  context: { apiBaseUrl: string; callbackSecret: string }
) {
  const job = JudgeJobSchema.parse(payload)
  const code = await loadCode(job.code, job.codeUri)
  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-judge-"))
  const sourcePath = path.join(workDir, "main.cpp")
  const binPath = path.join(workDir, "main.out")

  try {
    const timeLimit = job.timeLimitMs ?? 1000
    const testcases = job.testcases ?? []
    const cases: CaseResult[] = []

    const cppStdMap: Record<string, string> = {
      cpp11: "c++11",
      cpp14: "c++14",
      cpp17: "c++17",
    }

    const isCpp = Object.prototype.hasOwnProperty.call(cppStdMap, job.language)
    const isPython = job.language === "python"

    await writeFile(sourcePath, code, "utf8")

    if (isCpp) {
      const compile = await runCommand(
        "g++",
        ["-O2", `-std=${cppStdMap[job.language]}`, sourcePath, "-o", binPath],
        {
          cwd: workDir,
          timeoutMs: 10000,
        }
      )

      if (compile.timedOut || compile.code !== 0 || compile.killed) {
        await reportJudgeResult(context.apiBaseUrl, context.callbackSecret, job.submissionId, "COMPILE_ERROR", 0, [])
        return
      }
    } else if (!isPython) {
      await reportJudgeResult(context.apiBaseUrl, context.callbackSecret, job.submissionId, "SYSTEM_ERROR", 0, [])
      return
    }

    let totalScore = 0
    for (const testcase of testcases) {
      const input = await readTextUri(testcase.inputUri)
      const expected = await readTextUri(testcase.outputUri)
      const start = Date.now()
      const result = isCpp
        ? await runCommand(binPath, [], {
            cwd: workDir,
            input,
            timeoutMs: timeLimit,
          })
        : await runCommand("python3", [sourcePath], {
            cwd: workDir,
            input,
            timeoutMs: timeLimit,
          })
      const timeMs = Date.now() - start

      if (result.timedOut) {
        cases.push({
          testcaseId: testcase.testcaseId,
          status: "TIME_LIMIT_EXCEEDED",
          timeMs,
          memoryMb: 0,
          score: 0,
        })
        continue
      }

      if (result.code !== 0 || result.killed) {
        cases.push({
          testcaseId: testcase.testcaseId,
          status: "RUNTIME_ERROR",
          timeMs,
          memoryMb: 0,
          score: 0,
        })
        continue
      }

      const accepted = normalizeOutput(result.stdout) === normalizeOutput(expected)
      cases.push({
        testcaseId: testcase.testcaseId,
        status: accepted ? "ACCEPTED" : "WRONG_ANSWER",
        timeMs,
        memoryMb: 0,
        score: accepted ? testcase.score : 0,
      })
      totalScore += accepted ? testcase.score : 0
    }

    const finalStatus = cases.some((item) => item.status !== "ACCEPTED")
      ? cases.find((item) => item.status === "TIME_LIMIT_EXCEEDED")
        ? "TIME_LIMIT_EXCEEDED"
        : cases.find((item) => item.status === "RUNTIME_ERROR")
          ? "RUNTIME_ERROR"
          : "WRONG_ANSWER"
      : "ACCEPTED"

    await reportJudgeResult(context.apiBaseUrl, context.callbackSecret, job.submissionId, finalStatus, totalScore, cases)
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
