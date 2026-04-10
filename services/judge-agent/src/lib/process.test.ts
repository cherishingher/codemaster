import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { runCommand } from "./process.js"

test("runCommand truncates output and kills the child when output exceeds the limit", async () => {
  const workDir = await mkdtemp(path.join(tmpdir(), "codemaster-process-test-"))

  try {
    const result = await runCommand(
      process.execPath,
      [
        "-e",
        "process.stdout.write('a'.repeat(8192)); process.stderr.write('b'.repeat(8192)); setTimeout(() => {}, 5000);",
      ],
      {
        cwd: workDir,
        timeoutMs: 2000,
        maxOutputBytes: 1024,
      }
    )

    assert.equal(result.killed, true)
    assert.equal(result.timedOut, false)
    assert.ok(Buffer.byteLength(result.stdout, "utf8") + Buffer.byteLength(result.stderr, "utf8") <= 1024)
    assert.ok(result.stdout.length > 0 || result.stderr.length > 0)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
})
