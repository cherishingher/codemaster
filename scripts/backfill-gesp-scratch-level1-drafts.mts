import { createRequire } from "node:module"
import { PrismaClient, Prisma } from "@prisma/client"

const require = createRequire(import.meta.url)
const { isScratchRuleDraft, maybeBuildScratchRuleDraft } = require("../apps/web/src/lib/scratch-rule-draft.ts")
const { isSupportedScratchRuleSet } = require("../apps/web/src/lib/scratch-judge.ts")

const prisma = new PrismaClient({ log: ["error", "warn"] })

async function main() {
  const refreshDrafts = process.argv.includes("--refresh-drafts")

  const problems = await prisma.problem.findMany({
    where: {
      AND: [
        { tags: { some: { tag: { name: "gesp" } } } },
        { tags: { some: { tag: { name: "scratch" } } } },
        { tags: { some: { tag: { name: "一级" } } } },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      tags: {
        select: {
          tag: {
            select: { name: true },
          },
        },
      },
      versions: {
        orderBy: { version: "asc" },
        select: {
          id: true,
          version: true,
          statement: true,
          statementMd: true,
          scratchRules: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  })

  let scanned = 0
  let updated = 0
  const skipped: string[] = []

  for (const problem of problems) {
    const tags = problem.tags.map((item) => item.tag.name)

    for (const version of problem.versions) {
      scanned += 1
      const currentRules = version.scratchRules

      if (currentRules && isSupportedScratchRuleSet(currentRules)) {
        skipped.push(`${problem.slug}@v${version.version}:final`)
        continue
      }

      if (currentRules && !refreshDrafts && isScratchRuleDraft(currentRules)) {
        skipped.push(`${problem.slug}@v${version.version}:draft`)
        continue
      }

      const draft = maybeBuildScratchRuleDraft({
        statement: version.statement,
        statementMd: version.statementMd,
        tags,
      })
      if (!draft) {
        skipped.push(`${problem.slug}@v${version.version}:no-draft`)
        continue
      }

      await prisma.problemVersion.update({
        where: { id: version.id },
        data: {
          scratchRules: draft as Prisma.InputJsonValue,
        },
      })
      updated += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        updated,
        skipped,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
