import * as analysisModule from '/Users/cherisher/Desktop/ccf-master/codemaster/apps/web/src/lib/problem-analysis/index.ts'
import * as dbModule from '/Users/cherisher/Desktop/ccf-master/codemaster/apps/web/src/lib/db.ts'
const { db } = dbModule as typeof import('/Users/cherisher/Desktop/ccf-master/codemaster/apps/web/src/lib/db.ts')
const { analyzeProblemForTestdata } = analysisModule as typeof import('/Users/cherisher/Desktop/ccf-master/codemaster/apps/web/src/lib/problem-analysis/index.ts')
const p = await db.problem.findFirst({ where: { slug: 'problem-521' }, include: { currentVersion: true, tags: { include: { tag: true } } } })
if (!p || !p.currentVersion) throw new Error('missing problem')
const v = p.currentVersion
const result = analyzeProblemForTestdata({ problemId: p.id, versionId: v.id, title: p.title, statement: v.statement, statementMd: v.statementMd, solutionSource: '', solutionLanguage: 'cpp17', constraints: v.constraints, inputFormat: v.inputFormat, outputFormat: v.outputFormat, tags: p.tags.map((x) => x.tag.name) }, { testcaseCount: 10, totalScore: 100 })
console.log(JSON.stringify(result.analysis.recommendations.primaryGenerator, null, 2))
console.log(JSON.stringify(result.configDraft, null, 2))
