import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const { buildScratchRuleDraftFromStatement, completeScratchRuleDraft } = require("../apps/web/src/lib/scratch-rule-draft.ts")
const { evaluateScratchProject } = require("../apps/web/src/lib/scratch-judge.ts")
const { parseScratchProjectBuffer } = require("../apps/web/src/lib/scratch-project.ts")

async function main() {
  const statementPath = process.argv[2]
  const projectPath = process.argv[3]

  if (!statementPath || !projectPath) {
    console.error(
      "Usage: node --experimental-strip-types scripts/validate-scratch-draft-completion.mts <statement.txt> <answer.sb3|project.json>"
    )
    process.exit(1)
  }

  const [statement, projectBuffer] = await Promise.all([
    readFile(path.resolve(statementPath), "utf8"),
    readFile(path.resolve(projectPath)),
  ])

  const project = await parseScratchProjectBuffer(projectBuffer, projectPath)
  if (!project) {
    throw new Error("scratch_project_invalid")
  }

  const draft = buildScratchRuleDraftFromStatement(statement)
  const rules = completeScratchRuleDraft(project, draft)
  const result = evaluateScratchProject(project, rules)

  console.log(
    JSON.stringify(
      {
        statementPath: path.resolve(statementPath),
        projectPath: path.resolve(projectPath),
        draft,
        rules,
        result,
      },
      null,
      2
    )
  )

  if (result.status !== "AC") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
