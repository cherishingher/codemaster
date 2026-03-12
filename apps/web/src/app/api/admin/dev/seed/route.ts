import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { isAdminDevRouteEnabled } from "@/lib/admin-dev"
import { withAuth } from "@/lib/authz"
import { hashPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { createLogger } from "@/lib/logger"
import { SubmissionJudgeResult, UserProblemStatus } from "@/lib/oj"
import {
  buildJudgeConfigCreateManyInput,
  buildProblemLifecycleData,
  generateUniqueProblemSlug,
} from "@/lib/problem-admin"
import { storeTextAsset } from "@/lib/storage"
import { ensureVipMembershipProduct } from "@/server/modules/membership/service"

const logger = createLogger("admin-dev-seed")

type DemoUserSeed = {
  email: string
  name: string
  password: string
  roles: string[]
}

type SeedProblem = {
  key: string
  title: string
  difficulty: number
  visibility: "public" | "private" | "hidden" | "contest"
  source: string
  tags: string[]
  statement: string
  hints: string
  constraints: string
  inputFormat: string
  outputFormat: string
  samples: Array<{ input: string; output: string }>
  testcases: Array<{
    input: string
    output: string
    score: number
    isSample?: boolean
    orderIndex: number
  }>
  solutionTitle: string
  solutionSummary?: string
  solutionContent: string
  premiumSolution?: {
    title: string
    summary: string
    content: string
    accessLevel: string
    videoUrl?: string | null
  }
}

type EnsuredProblem = {
  key: string
  id: string
  slug: string
  versionId: string
  premiumSolutionId?: string | null
}

const DEMO_USERS: DemoUserSeed[] = [
  {
    email: "demo@student.local",
    name: "Demo Student",
    password: "Demo123456",
    roles: ["student"],
  },
  {
    email: "rival@student.local",
    name: "Rival Student",
    password: "Demo123456",
    roles: ["student"],
  },
  {
    email: "demo@parent.local",
    name: "Demo Parent",
    password: "Parent123456",
    roles: ["parent"],
  },
  {
    email: "demo@teacher.local",
    name: "Demo Teacher",
    password: "Teacher123456",
    roles: ["teacher"],
  },
]

const DEMO_PROBLEMS: SeedProblem[] = [
  {
    key: "intro-sum",
    title: "Seed 入门加法",
    difficulty: 1,
    visibility: "public",
    source: "seed",
    tags: ["入门", "模拟", "基础", "数组"],
    statement: "读取两个整数，输出它们的和。",
    hints: "使用最基础的输入输出即可。",
    constraints: "-1e9 <= a, b <= 1e9",
    inputFormat: "a b",
    outputFormat: "a + b",
    samples: [{ input: "1 2", output: "3" }],
    testcases: [
      { input: "1 2\n", output: "3\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "-5 9\n", output: "4\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "直接相加",
    solutionSummary: "最基础的读入和输出。",
    solutionContent: "按照题意读入两个整数后直接输出它们的和即可。",
  },
  {
    key: "string-palindrome",
    title: "Seed 字符串回文",
    difficulty: 1,
    visibility: "public",
    source: "seed",
    tags: ["字符串", "枚举", "基础"],
    statement: "判断一个字符串是否为回文串。",
    hints: "双指针从两端向中间移动。",
    constraints: "1 <= |s| <= 1e5",
    inputFormat: "s",
    outputFormat: "Yes / No",
    samples: [{ input: "level", output: "Yes" }],
    testcases: [
      { input: "level\n", output: "Yes\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "algorithm\n", output: "No\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "双指针判断",
    solutionSummary: "左右指针逐步逼近。",
    solutionContent: "使用两个指针分别指向字符串两端，每次比较后同时向中间移动。",
  },
  {
    key: "maze-bfs",
    title: "Seed 迷宫最短步数",
    difficulty: 2,
    visibility: "public",
    source: "seed",
    tags: ["搜索", "广度优先搜索", "BFS", "最短路", "图论"],
    statement: "给定一个迷宫，求从起点到终点的最短步数。",
    hints: "最短步数优先考虑 BFS。",
    constraints: "1 <= n, m <= 100",
    inputFormat: "n m + grid",
    outputFormat: "minimum steps",
    samples: [{ input: "3 3\nS..\n.#.\n..T", output: "4" }],
    testcases: [
      { input: "3 3\nS..\n.#.\n..T\n", output: "4\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "2 2\nS#\n#T\n", output: "-1\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "BFS 求最短路",
    solutionSummary: "队列分层搜索。",
    solutionContent: "将起点入队并逐层扩展，第一次到达终点时的距离就是最短步数。",
  },
  {
    key: "island-dfs",
    title: "Seed 连通块计数",
    difficulty: 2,
    visibility: "public",
    source: "seed",
    tags: ["搜索", "深度优先搜索", "DFS", "连通块"],
    statement: "给定 01 矩阵，统计连通块数量。",
    hints: "访问到一个未访问的 1 时启动 DFS。",
    constraints: "1 <= n, m <= 100",
    inputFormat: "n m + grid",
    outputFormat: "count",
    samples: [{ input: "3 3\n110\n010\n011", output: "1" }],
    testcases: [
      { input: "3 3\n110\n010\n011\n", output: "1\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "3 3\n101\n000\n101\n", output: "4\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "DFS / Flood Fill",
    solutionSummary: "遇到一个新块就染色。",
    solutionContent: "遍历网格，遇到尚未访问的陆地时 DFS 标记整块，并把答案加一。",
  },
  {
    key: "stairs-dp",
    title: "Seed 爬楼梯 DP",
    difficulty: 2,
    visibility: "public",
    source: "seed",
    tags: ["动态规划", "DP", "线性动态规划"],
    statement: "一次可以走 1 级或 2 级台阶，求走到第 n 级的方案数。",
    hints: "f[i] = f[i-1] + f[i-2]。",
    constraints: "1 <= n <= 1e5",
    inputFormat: "n",
    outputFormat: "count",
    samples: [{ input: "5", output: "8" }],
    testcases: [
      { input: "5\n", output: "8\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "8\n", output: "34\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "线性 DP 入门",
    solutionSummary: "经典的一维动态规划。",
    solutionContent: "定义 f[i] 为到达第 i 级台阶的方案数，转移只依赖前两项。",
  },
  {
    key: "bag-dp",
    title: "Seed 01 背包",
    difficulty: 3,
    visibility: "public",
    source: "seed",
    tags: ["动态规划", "DP", "背包动态规划"],
    statement: "给定容量和若干物品，求不超过容量的最大价值。",
    hints: "尝试一维倒序枚举容量。",
    constraints: "1 <= n <= 1000",
    inputFormat: "n W + items",
    outputFormat: "max value",
    samples: [{ input: "3 4\n2 3\n1 2\n3 4", output: "6" }],
    testcases: [
      { input: "3 4\n2 3\n1 2\n3 4\n", output: "6\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "2 5\n2 3\n4 5\n", output: "5\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "01 背包标准写法",
    solutionSummary: "倒序枚举容量避免重复使用。",
    solutionContent: "定义 dp[w] 表示容量为 w 时的最大价值，每加入一个物品就倒序转移。",
    premiumSolution: {
      title: "01 背包进阶题解",
      summary: "讲清状态设计、倒序原因、常见错法和滚动数组写法。",
      content:
        "这是一份高级题解，会从状态定义、倒序枚举的本质、二维到一维压缩、边界初始化和易错点五个部分进行完整拆解，并补充如何扩展到完全背包与多重背包。",
      accessLevel: "membership_or_purchase",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    },
  },
  {
    key: "union-find",
    title: "Seed 朋友关系并查集",
    difficulty: 3,
    visibility: "public",
    source: "seed",
    tags: ["图论", "并查集"],
    statement: "处理若干合并与查询操作，判断两点是否连通。",
    hints: "路径压缩和按秩合并。",
    constraints: "1 <= n, q <= 2e5",
    inputFormat: "n q + ops",
    outputFormat: "Yes / No",
    samples: [{ input: "4 3\nM 1 2\nQ 1 2\nQ 1 3", output: "Yes\nNo" }],
    testcases: [
      { input: "4 3\nM 1 2\nQ 1 2\nQ 1 3\n", output: "Yes\nNo\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "5 4\nM 1 2\nM 2 3\nQ 1 3\nQ 4 5\n", output: "Yes\nNo\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "并查集模板",
    solutionSummary: "维护连通性问题的常用结构。",
    solutionContent: "并查集适用于动态维护连通块，通过路径压缩优化查询复杂度。",
  },
  {
    key: "sliding-window",
    title: "Seed 滑动窗口极值",
    difficulty: 4,
    visibility: "public",
    source: "seed",
    tags: ["单调队列", "滑动窗口", "高级算法"],
    statement: "求长度为 k 的每个窗口中的最小值。",
    hints: "维护单调递增队列。",
    constraints: "1 <= n <= 2e5",
    inputFormat: "n k + nums",
    outputFormat: "mins",
    samples: [{ input: "8 3\n1 3 -1 -3 5 3 6 7", output: "-1 -3 -3 -3 3 3" }],
    testcases: [
      { input: "8 3\n1 3 -1 -3 5 3 6 7\n", output: "-1 -3 -3 -3 3 3\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "5 2\n4 2 12 3 5\n", output: "2 2 3 3\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "单调队列维护窗口最值",
    solutionSummary: "窗口移动时维护一个有序候选集。",
    solutionContent: "用下标队列维护候选位置，队首始终是当前窗口最优答案。",
  },
  {
    key: "two-sum-interview",
    title: "Seed 面试热身两数之和",
    difficulty: 2,
    visibility: "public",
    source: "seed",
    tags: ["哈希", "数组", "双指针", "设计"],
    statement: "给定数组和目标值，返回两个数的下标。",
    hints: "哈希表记录已经访问过的值。",
    constraints: "2 <= n <= 1e5",
    inputFormat: "n target + nums",
    outputFormat: "i j",
    samples: [{ input: "4 9\n2 7 11 15", output: "0 1" }],
    testcases: [
      { input: "4 9\n2 7 11 15\n", output: "0 1\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "5 6\n3 2 4 1 9\n", output: "1 2\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "哈希表秒解",
    solutionSummary: "面试高频题，重点是时间复杂度。",
    solutionContent: "边遍历边查找 target - nums[i] 是否已经出现过。",
  },
]

const DEMO_TIMELINE = {
  yesterday: new Date(Date.now() - 24 * 60 * 60 * 1000),
  twoDaysAgo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  threeDaysAgo: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  fiveDaysAgo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

async function ensureRole(name: string) {
  return db.role.upsert({
    where: { name },
    update: {},
    create: { name },
  })
}

async function ensureUserRole(userId: string, roleName: string) {
  const role = await ensureRole(roleName)
  await db.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
    },
  })
}

async function ensureDemoUser(input: DemoUserSeed) {
  const password = await hashPassword(input.password)
  const user = await db.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      password,
      status: "active",
    },
    create: {
      email: input.email,
      name: input.name,
      password,
      status: "active",
    },
  })

  for (const role of input.roles) {
    await ensureUserRole(user.id, role)
  }

  return user
}

async function ensureProblem(seed: SeedProblem, authorId: string): Promise<EnsuredProblem> {
  const existing = await db.problem.findFirst({
    where: { title: seed.title },
    include: {
      currentVersion: true,
      solutions: true,
    },
  })

  if (existing?.currentVersion) {
    for (const tagName of seed.tags) {
      const tag = await db.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      })
      await db.problemTag.upsert({
        where: {
          problemId_tagId: {
            problemId: existing.id,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          problemId: existing.id,
          tagId: tag.id,
        },
      })
    }

    const solution = existing.solutions.find((item) => item.title === seed.solutionTitle)
    if (!solution) {
      await db.solution.create({
        data: {
          problemId: existing.id,
          versionId: existing.currentVersion.id,
          title: seed.solutionTitle,
          summary: seed.solutionSummary ?? null,
          content: seed.solutionContent,
          type: "official",
          visibility: "public",
          accessLevel: "public",
          authorId,
          status: "published",
        },
      })
    }

    let premiumSolutionId: string | null = null
    if (seed.premiumSolution) {
      const premium = existing.solutions.find((item) => item.title === seed.premiumSolution?.title)
      const premiumSolution = premium
        ? await db.solution.update({
            where: { id: premium.id },
            data: {
              summary: seed.premiumSolution.summary,
              content: seed.premiumSolution.content,
              accessLevel: seed.premiumSolution.accessLevel,
              isPremium: true,
              videoUrl: seed.premiumSolution.videoUrl,
              visibility: "public",
              status: "published",
            },
          })
        : await db.solution.create({
            data: {
              problemId: existing.id,
              versionId: existing.currentVersion.id,
              title: seed.premiumSolution.title,
              summary: seed.premiumSolution.summary,
              content: seed.premiumSolution.content,
              accessLevel: seed.premiumSolution.accessLevel,
              isPremium: true,
              videoUrl: seed.premiumSolution.videoUrl,
              type: "official",
              visibility: "public",
              authorId,
              status: "published",
            },
          })
      premiumSolutionId = premiumSolution.id
    }

    return {
      key: seed.key,
      id: existing.id,
      slug: existing.slug,
      versionId: existing.currentVersion.id,
      premiumSolutionId,
    }
  }

  return db.$transaction(async (tx) => {
    const slug = await generateUniqueProblemSlug(tx, seed.title)
    const lifecycle = buildProblemLifecycleData(seed.visibility)

    const problem = await tx.problem.create({
      data: {
        slug,
        title: seed.title,
        difficulty: seed.difficulty,
        status: lifecycle.status,
        visible: lifecycle.visible,
        defunct: lifecycle.defunct,
        visibility: seed.visibility,
        source: seed.source,
        publishedAt: lifecycle.publishedAt,
      },
    })

    for (const tagName of seed.tags) {
      const tag = await tx.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      })
      await tx.problemTag.create({
        data: {
          problemId: problem.id,
          tagId: tag.id,
        },
      })
    }

    const version = await tx.problemVersion.create({
      data: {
        problemId: problem.id,
        version: 1,
        statement: seed.statement,
        statementMd: seed.statement,
        constraints: seed.constraints,
        hints: seed.hints,
        inputFormat: seed.inputFormat,
        outputFormat: seed.outputFormat,
        samples: asJson(seed.samples),
        notes: seed.solutionContent,
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      },
    })

    await tx.problem.update({
      where: { id: problem.id },
      data: { currentVersionId: version.id },
    })

    for (const testcase of seed.testcases) {
      const inputUri = await storeTextAsset("inputs", testcase.input)
      const outputUri = await storeTextAsset("outputs", testcase.output)
      await tx.testcase.create({
        data: {
          versionId: version.id,
          title: testcase.isSample ? "sample" : "hidden",
          caseType: testcase.isSample ? 0 : 1,
          visible: testcase.isSample ?? false,
          inputUri,
          outputUri,
          score: testcase.score,
          isSample: testcase.isSample ?? false,
          orderIndex: testcase.orderIndex,
        },
      })
    }

    const judgeConfigs = buildJudgeConfigCreateManyInput({
      versionId: version.id,
      tags: seed.tags,
      timeLimitMs: version.timeLimitMs,
      memoryLimitMb: version.memoryLimitMb,
    })
    if (judgeConfigs.length) {
      await tx.problemJudgeConfig.createMany({
        data: judgeConfigs,
        skipDuplicates: true,
      })
    }

    await tx.solution.create({
      data: {
        problemId: problem.id,
        versionId: version.id,
        title: seed.solutionTitle,
        summary: seed.solutionSummary ?? null,
        content: seed.solutionContent,
        type: "official",
        visibility: "public",
        accessLevel: "public",
        authorId,
        status: "published",
      },
    })

    let premiumSolutionId: string | null = null
    if (seed.premiumSolution) {
      const premium = await tx.solution.create({
        data: {
          problemId: problem.id,
          versionId: version.id,
          title: seed.premiumSolution.title,
          summary: seed.premiumSolution.summary,
          content: seed.premiumSolution.content,
          type: "official",
          visibility: "public",
          accessLevel: seed.premiumSolution.accessLevel,
          isPremium: true,
          videoUrl: seed.premiumSolution.videoUrl,
          authorId,
          status: "published",
        },
      })
      premiumSolutionId = premium.id
    }

    return {
      key: seed.key,
      id: problem.id,
      slug: problem.slug,
      versionId: version.id,
      premiumSolutionId,
    }
  })
}

async function ensureCourseVideo(adminId: string) {
  const course = await db.course.upsert({
    where: { slug: "seed-vip-course" },
    update: {
      title: "Seed 视频解析课",
      summary: "用于演示内容包和会员视频权限的最小课程。",
      description: "一节会员可见的视频解析课。",
      category: "seed",
      coverImage: null,
      status: "published",
      sortOrder: 0,
    },
    create: {
      slug: "seed-vip-course",
      title: "Seed 视频解析课",
      summary: "用于演示内容包和会员视频权限的最小课程。",
      description: "一节会员可见的视频解析课。",
      category: "seed",
      coverImage: null,
      status: "published",
      sortOrder: 0,
    },
  })

  const section = await db.section.upsert({
    where: { slug: "seed-vip-section" },
    update: {
      courseId: course.id,
      title: "动态规划视频解析",
      description: "单节视频解析章节。",
      sortOrder: 0,
    },
    create: {
      slug: "seed-vip-section",
      courseId: course.id,
      title: "动态规划视频解析",
      description: "单节视频解析章节。",
      sortOrder: 0,
    },
  })

  const lesson = await db.lesson.upsert({
    where: { slug: "seed-video-analysis" },
    update: {
      sectionId: section.id,
      title: "01 背包视频解析",
      type: "video",
      summary: "讲解 01 背包的状态设计与转移。",
      content: "本节课会拆解背包问题的状态定义、滚动数组和常见陷阱。",
      assetUri: "https://www.w3schools.com/html/mov_bbb.mp4",
      thumbnailUrl: null,
      durationSec: 480,
      isPreview: false,
      status: "published",
      sortOrder: 0,
    },
    create: {
      slug: "seed-video-analysis",
      sectionId: section.id,
      title: "01 背包视频解析",
      type: "video",
      summary: "讲解 01 背包的状态设计与转移。",
      content: "本节课会拆解背包问题的状态定义、滚动数组和常见陷阱。",
      assetUri: "https://www.w3schools.com/html/mov_bbb.mp4",
      thumbnailUrl: null,
      durationSec: 480,
      isPreview: false,
      status: "published",
      sortOrder: 0,
    },
  })

  await db.contentAsset.upsert({
    where: {
      id: `seed-content-asset-${lesson.id}`,
    },
    update: {
      assetType: "video",
      title: lesson.title,
      description: lesson.summary,
      status: "published",
      sourceUrl: lesson.assetUri ?? "https://www.w3schools.com/html/mov_bbb.mp4",
      mimeType: "video/mp4",
      durationSec: lesson.durationSec,
      resourceType: "lesson",
      resourceId: lesson.id,
      uploaderId: adminId,
    },
    create: {
      id: `seed-content-asset-${lesson.id}`,
      assetType: "video",
      title: lesson.title,
      description: lesson.summary,
      status: "published",
      sourceUrl: lesson.assetUri ?? "https://www.w3schools.com/html/mov_bbb.mp4",
      mimeType: "video/mp4",
      durationSec: lesson.durationSec,
      resourceType: "lesson",
      resourceId: lesson.id,
      uploaderId: adminId,
    },
  })

  await ensureWorkflowLog({
    resourceType: "lesson",
    resourceId: lesson.id,
    fromStatus: "draft",
    toStatus: "published",
    action: "seed_publish",
    note: "生成最小可用视频演示数据",
    operatorId: adminId,
  })

  return { course, section, lesson }
}

async function ensureWorkflowLog(input: {
  resourceType: string
  resourceId: string
  fromStatus?: string | null
  toStatus: string
  action: string
  note?: string | null
  operatorId: string
}) {
  const existing = await db.contentWorkflowLog.findFirst({
    where: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      toStatus: input.toStatus,
      action: input.action,
    },
    select: { id: true },
  })

  if (!existing) {
    await db.contentWorkflowLog.create({
      data: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        action: input.action,
        note: input.note,
        operatorId: input.operatorId,
      },
    })
  }
}

async function ensureProblemSet(ownerId: string, title: string, slug: string, problemIds: string[]) {
  const set = await db.problemSet.upsert({
    where: { slug },
    update: {
      title,
      summary: "用于训练路径、班级作业和内容包的最小题单。",
      description: "收录动态规划与图论的代表性示例题。",
      kind: "training_path",
      status: "published",
      visibility: "public",
      ownerId,
    },
    create: {
      slug,
      title,
      summary: "用于训练路径、班级作业和内容包的最小题单。",
      description: "收录动态规划与图论的代表性示例题。",
      kind: "training_path",
      status: "published",
      visibility: "public",
      ownerId,
    },
  })

  await db.problemSetItem.deleteMany({
    where: { setId: set.id },
  })

  if (problemIds.length) {
    await db.problemSetItem.createMany({
      data: problemIds.map((problemId, index) => ({
        setId: set.id,
        problemId,
        orderIndex: index + 1,
      })),
      skipDuplicates: true,
    })
  }

  return set
}

async function ensureProductWithSku(input: {
  slug: string
  name: string
  summary: string
  description: string
  type: string
  targetType?: string | null
  targetId?: string | null
  validDays?: number | null
  priceCents: number
  tags?: string[]
  metadata?: Record<string, unknown> | null
  sku: {
    skuCode: string
    name: string
    description?: string | null
    priceCents: number
    originalPriceCents?: number | null
    validDays?: number | null
  }
  benefits?: Array<{
    title: string
    description?: string | null
    benefitType?: string
  }>
}) {
  const product = await db.product.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      summary: input.summary,
      description: input.description,
      type: input.type,
      status: "active",
      priceCents: input.priceCents,
      validDays: input.validDays ?? null,
      currency: "CNY",
      sortOrder: 0,
      tags: asJson(input.tags ?? []),
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ? asJson(input.metadata) : Prisma.DbNull,
    },
    create: {
      slug: input.slug,
      name: input.name,
      summary: input.summary,
      description: input.description,
      type: input.type,
      status: "active",
      priceCents: input.priceCents,
      validDays: input.validDays ?? null,
      currency: "CNY",
      sortOrder: 0,
      tags: asJson(input.tags ?? []),
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ? asJson(input.metadata) : Prisma.DbNull,
    },
  })

  const sku = await db.productSku.upsert({
    where: {
      productId_skuCode: {
        productId: product.id,
        skuCode: input.sku.skuCode,
      },
    },
    update: {
      name: input.sku.name,
      description: input.sku.description ?? null,
      priceCents: input.sku.priceCents,
      originalPriceCents: input.sku.originalPriceCents ?? null,
      currency: "CNY",
      validDays: input.sku.validDays ?? input.validDays ?? null,
      status: "active",
      isDefault: true,
      sortOrder: 0,
    },
    create: {
      productId: product.id,
      skuCode: input.sku.skuCode,
      name: input.sku.name,
      description: input.sku.description ?? null,
      priceCents: input.sku.priceCents,
      originalPriceCents: input.sku.originalPriceCents ?? null,
      currency: "CNY",
      validDays: input.sku.validDays ?? input.validDays ?? null,
      status: "active",
      isDefault: true,
      sortOrder: 0,
    },
  })

  if (input.benefits) {
    await db.productBenefit.deleteMany({
      where: { productId: product.id },
    })
    await db.productBenefit.createMany({
      data: input.benefits.map((benefit, index) => ({
        productId: product.id,
        title: benefit.title,
        description: benefit.description ?? null,
        benefitType: benefit.benefitType ?? "text",
        sortOrder: index,
      })),
      skipDuplicates: true,
    })
  }

  return { product, sku }
}

async function ensureCompletedOrder(input: {
  orderNo: string
  paymentNo: string
  userId: string
  productId: string
  skuId: string
  amountCents: number
  productName: string
  skuName: string
  validDays?: number | null
  paidAt: Date
}) {
  const order = await db.order.upsert({
    where: { orderNo: input.orderNo },
    update: {
      userId: input.userId,
      productId: input.productId,
      skuId: input.skuId,
      amountCents: input.amountCents,
      currency: "CNY",
      productNameSnapshot: input.productName,
      skuNameSnapshot: input.skuName,
      validDaysSnapshot: input.validDays ?? null,
      status: "COMPLETED",
      paidAt: input.paidAt,
      updatedAt: input.paidAt,
    },
    create: {
      orderNo: input.orderNo,
      userId: input.userId,
      productId: input.productId,
      skuId: input.skuId,
      amountCents: input.amountCents,
      currency: "CNY",
      productNameSnapshot: input.productName,
      skuNameSnapshot: input.skuName,
      validDaysSnapshot: input.validDays ?? null,
      status: "COMPLETED",
      createdAt: input.paidAt,
      paidAt: input.paidAt,
      updatedAt: input.paidAt,
    },
  })

  const payment = await db.payment.upsert({
    where: { paymentNo: input.paymentNo },
    update: {
      orderId: order.id,
      channel: "MOCK",
      status: "SUCCEEDED",
      amountCents: input.amountCents,
      callbackPayload: asJson({ seed: true, status: "SUCCEEDED" }),
      callbackAt: input.paidAt,
      paidAt: input.paidAt,
      entitlementGrantedAt: input.paidAt,
      updatedAt: input.paidAt,
    },
    create: {
      paymentNo: input.paymentNo,
      orderId: order.id,
      channel: "MOCK",
      status: "SUCCEEDED",
      amountCents: input.amountCents,
      callbackPayload: asJson({ seed: true, status: "SUCCEEDED" }),
      callbackAt: input.paidAt,
      createdAt: input.paidAt,
      paidAt: input.paidAt,
      entitlementGrantedAt: input.paidAt,
      updatedAt: input.paidAt,
    },
  })

  return { order, payment }
}

async function ensureEntitlement(input: {
  userId: string
  productId: string
  sourceId: string
  expiresAt?: Date | null
}) {
  return db.entitlement.upsert({
    where: {
      userId_productId: {
        userId: input.userId,
        productId: input.productId,
      },
    },
    update: {
      sourceType: "PURCHASE",
      sourceId: input.sourceId,
      grantedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
    },
    create: {
      userId: input.userId,
      productId: input.productId,
      sourceType: "PURCHASE",
      sourceId: input.sourceId,
      grantedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
    },
  })
}

async function ensureMembershipForUser(input: {
  userId: string
  productId: string
  skuId: string
  orderId: string
  startedAt: Date
  expiresAt: Date
}) {
  return db.membershipSubscription.upsert({
    where: {
      userId_tier: {
        userId: input.userId,
        tier: "VIP",
      },
    },
    update: {
      productId: input.productId,
      skuId: input.skuId,
      status: "ACTIVE",
      startedAt: input.startedAt,
      expiresAt: input.expiresAt,
      lastOrderId: input.orderId,
    },
    create: {
      userId: input.userId,
      productId: input.productId,
      skuId: input.skuId,
      tier: "VIP",
      status: "ACTIVE",
      startedAt: input.startedAt,
      expiresAt: input.expiresAt,
      lastOrderId: input.orderId,
    },
  })
}

async function ensureSubmission(input: {
  userId: string
  problemId: string
  versionId: string
  status: string
  judgeResult: number
  score: number
  code: string
  createdAt: Date
  finishedAt: Date
}) {
  const existing = await db.submission.findFirst({
    where: {
      userId: input.userId,
      problemId: input.problemId,
      code: input.code,
    },
    select: { id: true },
  })

  if (existing) {
    return db.submission.update({
      where: { id: existing.id },
      data: {
        problemVersionId: input.versionId,
        lang: "cpp17",
        languageId: 1,
        code: input.code,
        status: input.status,
        judgeResult: input.judgeResult,
        score: input.score,
        judgeBackend: "seed",
        timeUsedMs: 32,
        memoryUsedKb: 1024,
        createdAt: input.createdAt,
        finishedAt: input.finishedAt,
        updatedAt: input.finishedAt,
      },
    })
  }

  return db.submission.create({
    data: {
      userId: input.userId,
      problemId: input.problemId,
      problemVersionId: input.versionId,
      lang: "cpp17",
      languageId: 1,
      code: input.code,
      status: input.status,
      judgeResult: input.judgeResult,
      score: input.score,
      judgeBackend: "seed",
      timeUsedMs: 32,
      memoryUsedKb: 1024,
      createdAt: input.createdAt,
      finishedAt: input.finishedAt,
      updatedAt: input.finishedAt,
    },
  })
}

async function ensureUserProblemProgress(input: {
  userId: string
  problemId: string
  status: number
  attempts: number
  bestScore: number
  lastStatus: string
  solvedAt?: Date | null
  lastSubmissionId?: string | null
  updatedAt: Date
}) {
  return db.userProblemProgress.upsert({
    where: {
      userId_problemId: {
        userId: input.userId,
        problemId: input.problemId,
      },
    },
    update: {
      status: input.status,
      attempts: input.attempts,
      bestScore: input.bestScore,
      lastStatus: input.lastStatus,
      solvedAt: input.solvedAt ?? null,
      lastSubmissionId: input.lastSubmissionId ?? null,
      updatedAt: input.updatedAt,
    },
    create: {
      userId: input.userId,
      problemId: input.problemId,
      status: input.status,
      attempts: input.attempts,
      bestScore: input.bestScore,
      lastStatus: input.lastStatus,
      solvedAt: input.solvedAt ?? null,
      lastSubmissionId: input.lastSubmissionId ?? null,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
    },
  })
}

async function refreshProblemStats(problemIds: string[]) {
  for (const problemId of problemIds) {
    const submissions = await db.submission.findMany({
      where: { problemId },
      select: {
        judgeResult: true,
        timeUsedMs: true,
        memoryUsedKb: true,
      },
    })

    const total = submissions.length
    const accepted = submissions.filter((item) => item.judgeResult === SubmissionJudgeResult.ACCEPTED).length
    const avgTimeMs =
      total > 0
        ? Math.round(submissions.reduce((sum, item) => sum + (item.timeUsedMs ?? 0), 0) / total)
        : 0
    const avgMemoryMb =
      total > 0
        ? Math.round(
            submissions.reduce((sum, item) => sum + Math.round((item.memoryUsedKb ?? 0) / 1024), 0) / total,
          )
        : 0

    await db.problem.update({
      where: { id: problemId },
      data: {
        totalSubmissions: total,
        acceptedSubmissions: accepted,
        passRate: total > 0 ? accepted / total : 0,
      },
    })

    await db.problemStat.upsert({
      where: { problemId },
      update: {
        totalSubmissions: total,
        acceptedSubmissions: accepted,
        passRate: total > 0 ? accepted / total : 0,
        avgTimeMs,
        avgMemoryMb,
        updatedAt: new Date(),
      },
      create: {
        problemId,
        totalSubmissions: total,
        acceptedSubmissions: accepted,
        passRate: total > 0 ? accepted / total : 0,
        avgTimeMs,
        avgMemoryMb,
      },
    })
  }
}

export const POST = withAuth(
  async (_req, _ctx, admin) => {
    if (!isAdminDevRouteEnabled()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    logger.info("seed_started", {
      adminId: admin.id,
      adminEmail: admin.email ?? null,
    })

    try {
      await ensureRole("student")
      await ensureRole("teacher")
      await ensureRole("parent")

      const users = new Map<string, Awaited<ReturnType<typeof ensureDemoUser>>>()
      for (const user of DEMO_USERS) {
        users.set(user.email, await ensureDemoUser(user))
      }

      const demoStudent = users.get("demo@student.local")
      const rivalStudent = users.get("rival@student.local")
      const demoParent = users.get("demo@parent.local")
      const demoTeacher = users.get("demo@teacher.local")

      if (!demoStudent || !rivalStudent || !demoParent || !demoTeacher) {
        logger.error("seed_user_creation_failed", {
          adminId: admin.id,
        })
        return NextResponse.json({ ok: false, error: "seed_user_creation_failed" }, { status: 500 })
      }

      const ensuredProblems = new Map<string, EnsuredProblem>()
      for (const seed of DEMO_PROBLEMS) {
        const problem = await ensureProblem(seed, admin.id)
        ensuredProblems.set(seed.key, problem)
      }

      const videoSeed = await ensureCourseVideo(admin.id)

      const dpProblemSet = await ensureProblemSet(
        admin.id,
        "Seed 动态规划题单",
        "seed-dp-problem-set",
        [
          ensuredProblems.get("stairs-dp")?.id,
          ensuredProblems.get("bag-dp")?.id,
          ensuredProblems.get("union-find")?.id,
        ].filter((item): item is string => Boolean(item)),
      )

      await ensureWorkflowLog({
        resourceType: "problem_set",
        resourceId: dpProblemSet.id,
        fromStatus: "draft",
        toStatus: "published",
        action: "seed_publish",
        note: "生成最小可用训练路径题单",
        operatorId: admin.id,
      })

      const contentPackTargets = [
      {
        type: "training_path",
        id: "dynamic-programming",
        title: "动态规划路径",
        summary: "进阶专题训练路径",
      },
      {
        type: "solution",
        id: ensuredProblems.get("bag-dp")?.premiumSolutionId ?? "",
        title: "01 背包进阶题解",
        summary: "高级题解与视频解析",
      },
      {
        type: "video",
        id: videoSeed.lesson.id,
        title: videoSeed.lesson.title,
        summary: videoSeed.lesson.summary,
      },
      {
        type: "problem_set",
        id: dpProblemSet.id,
        title: dpProblemSet.title,
        summary: dpProblemSet.summary,
      },
    ].filter((item) => item.id)

    const contentPack = await ensureProductWithSku({
      slug: "seed-dp-content-pack",
      name: "动态规划进阶内容包",
      summary: "覆盖动态规划专题路径、高级题解、视频解析和一份题单。",
      description: "用于演示内容包购买后的统一解锁效果。",
      type: "content_pack",
      targetType: "training_path",
      targetId: "dynamic-programming",
      validDays: 90,
      priceCents: 5900,
      tags: ["动态规划", "内容包", "高级题解"],
      metadata: {
        includedTargets: contentPackTargets,
      },
      sku: {
        skuCode: "dp-pack-standard",
        name: "标准解锁版",
        description: "购买后解锁路径、题解、视频和题单。",
        priceCents: 5900,
        originalPriceCents: 7900,
        validDays: 90,
      },
      benefits: [
        { title: "动态规划进阶路径", description: "解锁动态规划路径的完整内容。" },
        { title: "高级题解", description: "解锁 01 背包进阶题解与视频解析。" },
        { title: "专题题单", description: "附带一份可用于班级布置的训练题单。" },
      ],
    })

    const membershipProduct = await ensureVipMembershipProduct(db)
    const membershipDefaultSku =
      membershipProduct.skus.find((item) => item.skuCode === "vip-month") ??
      membershipProduct.skus.find((item) => item.isDefault) ??
      membershipProduct.skus[0]

    if (!membershipDefaultSku) {
      return NextResponse.json({ ok: false, error: "membership_sku_missing" }, { status: 500 })
    }

    const upcomingContestStart = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const upcomingContestEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const finishedContestStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    const finishedContestEnd = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

    const upcomingContest = await db.contest.upsert({
      where: { slug: "seed-weekly-contest" },
      update: {
        name: "Seed 周赛体验场",
        summary: "用于演示模拟赛报名、题目预览与商品导流。",
        description: "公开可见，支持报名商品购买。",
        status: "published",
        visibility: "public",
        accessLevel: "public",
        registrationLimit: 100,
        registrationStartAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        registrationEndAt: upcomingContestStart,
        startAt: upcomingContestStart,
        endAt: upcomingContestEnd,
        rule: "ACM",
        publishedAt: new Date(),
      },
      create: {
        slug: "seed-weekly-contest",
        name: "Seed 周赛体验场",
        summary: "用于演示模拟赛报名、题目预览与商品导流。",
        description: "公开可见，支持报名商品购买。",
        status: "published",
        visibility: "public",
        accessLevel: "public",
        registrationLimit: 100,
        registrationStartAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        registrationEndAt: upcomingContestStart,
        startAt: upcomingContestStart,
        endAt: upcomingContestEnd,
        rule: "ACM",
        publishedAt: new Date(),
      },
    })

    await db.contestProblem.deleteMany({ where: { contestId: upcomingContest.id } })
    await db.contestProblem.createMany({
      data: [
        ensuredProblems.get("intro-sum"),
        ensuredProblems.get("maze-bfs"),
        ensuredProblems.get("stairs-dp"),
      ]
        .filter((item): item is EnsuredProblem => Boolean(item))
        .map((problem, index) => ({
          contestId: upcomingContest.id,
          problemId: problem.id,
          order: index + 1,
        })),
      skipDuplicates: true,
    })

    const finishedContest = await db.contest.upsert({
      where: { slug: "seed-contest-review" },
      update: {
        name: "Seed 赛后复盘场",
        summary: "用于演示成绩页、赛后解析和赛后报告。",
        description: "比赛已结束，赛后解析与报告通过购买解锁。",
        status: "published",
        visibility: "public",
        accessLevel: "public",
        registrationLimit: 50,
        registrationStartAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        registrationEndAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        startAt: finishedContestStart,
        endAt: finishedContestEnd,
        rule: "ACM",
        publishedAt: new Date(),
      },
      create: {
        slug: "seed-contest-review",
        name: "Seed 赛后复盘场",
        summary: "用于演示成绩页、赛后解析和赛后报告。",
        description: "比赛已结束，赛后解析与报告通过购买解锁。",
        status: "published",
        visibility: "public",
        accessLevel: "public",
        registrationLimit: 50,
        registrationStartAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        registrationEndAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        startAt: finishedContestStart,
        endAt: finishedContestEnd,
        rule: "ACM",
        publishedAt: new Date(),
      },
    })

    await db.contestProblem.deleteMany({ where: { contestId: finishedContest.id } })
    await db.contestProblem.createMany({
      data: [
        ensuredProblems.get("string-palindrome"),
        ensuredProblems.get("bag-dp"),
        ensuredProblems.get("union-find"),
      ]
        .filter((item): item is EnsuredProblem => Boolean(item))
        .map((problem, index) => ({
          contestId: finishedContest.id,
          problemId: problem.id,
          order: index + 1,
        })),
      skipDuplicates: true,
    })

    await db.contestUnlockRule.upsert({
      where: {
        contestId_resourceType: {
          contestId: finishedContest.id,
          resourceType: "contest_analysis",
        },
      },
      update: {
        requiredSource: "PURCHASE",
        startsAt: finishedContestEnd,
        isEnabled: true,
        summary: "购买后查看赛后解析",
      },
      create: {
        contestId: finishedContest.id,
        resourceType: "contest_analysis",
        requiredSource: "PURCHASE",
        startsAt: finishedContestEnd,
        isEnabled: true,
        summary: "购买后查看赛后解析",
      },
    })

    await db.contestUnlockRule.upsert({
      where: {
        contestId_resourceType: {
          contestId: finishedContest.id,
          resourceType: "contest_report",
        },
      },
      update: {
        requiredSource: "PURCHASE",
        startsAt: finishedContestEnd,
        isEnabled: true,
        summary: "购买后查看赛后报告",
      },
      create: {
        contestId: finishedContest.id,
        resourceType: "contest_report",
        requiredSource: "PURCHASE",
        startsAt: finishedContestEnd,
        isEnabled: true,
        summary: "购买后查看赛后报告",
      },
    })

    const openContestProduct = await ensureProductWithSku({
      slug: "seed-weekly-contest-pass",
      name: "Seed 周赛报名券",
      summary: "用于演示报名商品和订单链路。",
      description: "报名后可加入周赛体验场。",
      type: "contest_pass",
      targetType: "contest",
      targetId: upcomingContest.id,
      priceCents: 1990,
      tags: ["模拟赛", "报名"],
      metadata: {
        contestGroupKey: "public",
        contestGroupLabel: "公开组",
      },
      sku: {
        skuCode: "contest-open-standard",
        name: "公开组报名",
        description: "周赛体验场公开组报名券。",
        priceCents: 1990,
        originalPriceCents: 2990,
      },
      benefits: [
        { title: "模拟赛报名", description: "获得进入周赛体验场的资格。" },
      ],
    })

    const reviewContestProduct = await ensureProductWithSku({
      slug: "seed-contest-review-pass",
      name: "Seed 赛后复盘通行证",
      summary: "解锁赛后解析、赛后报告与成绩复盘。",
      description: "用于演示模拟赛收费和赛后内容权限。",
      type: "contest_review",
      targetType: "contest",
      targetId: finishedContest.id,
      validDays: 180,
      priceCents: 2990,
      tags: ["模拟赛", "赛后解析"],
      sku: {
        skuCode: "contest-review-standard",
        name: "标准复盘版",
        description: "购买后解锁解析与报告。",
        priceCents: 2990,
        originalPriceCents: 3990,
        validDays: 180,
      },
      benefits: [
        { title: "赛后解析", description: "查看比赛解析与典型解法。" },
        { title: "赛后报告", description: "查看个人成绩与分组排名。" },
      ],
    })

    const organization = await db.organization.upsert({
      where: { slug: "seed-school" },
      update: {
        name: "Seed 算法实验学校",
        shortName: "Seed School",
        type: "school",
        status: "active",
        description: "用于演示机构、教师、班级和作业统计。",
        contactName: "Demo Teacher",
        contactEmail: demoTeacher.email,
      },
      create: {
        slug: "seed-school",
        name: "Seed 算法实验学校",
        shortName: "Seed School",
        type: "school",
        status: "active",
        description: "用于演示机构、教师、班级和作业统计。",
        contactName: "Demo Teacher",
        contactEmail: demoTeacher.email,
      },
    })

    await db.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: demoTeacher.id,
        },
      },
      update: {
        role: "org_admin",
        status: "active",
      },
      create: {
        organizationId: organization.id,
        userId: demoTeacher.id,
        role: "org_admin",
        status: "active",
      },
    })

    for (const student of [demoStudent, rivalStudent]) {
      await db.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: student.id,
          },
        },
        update: {
          role: "student",
          status: "active",
        },
        create: {
          organizationId: organization.id,
          userId: student.id,
          role: "student",
          status: "active",
        },
      })
    }

    await db.teacherProfile.upsert({
      where: { userId: demoTeacher.id },
      update: {
        organizationId: organization.id,
        displayName: "Demo Teacher",
        title: "算法教师",
        bio: "负责演示班级与训练营管理。",
        specialties: asJson(["动态规划", "图论", "模拟赛"]),
        status: "active",
      },
      create: {
        userId: demoTeacher.id,
        organizationId: organization.id,
        displayName: "Demo Teacher",
        title: "算法教师",
        bio: "负责演示班级与训练营管理。",
        specialties: asJson(["动态规划", "图论", "模拟赛"]),
        status: "active",
      },
    })

    const teachingGroup = await db.teachingGroup.upsert({
      where: { slug: "seed-class-a" },
      update: {
        organizationId: organization.id,
        ownerId: demoTeacher.id,
        name: "Seed 班级 A",
        code: "SEED-A",
        externalCode: "seed-class-a",
        groupType: "class",
        status: "active",
        summary: "用于演示班级成员、题单布置和统计。",
      },
      create: {
        slug: "seed-class-a",
        organizationId: organization.id,
        ownerId: demoTeacher.id,
        name: "Seed 班级 A",
        code: "SEED-A",
        externalCode: "seed-class-a",
        groupType: "class",
        status: "active",
        summary: "用于演示班级成员、题单布置和统计。",
      },
    })

    await db.teachingGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: teachingGroup.id,
          userId: demoTeacher.id,
        },
      },
      update: { memberRole: "teacher", status: "active" },
      create: {
        groupId: teachingGroup.id,
        userId: demoTeacher.id,
        memberRole: "teacher",
        status: "active",
      },
    })

    for (const student of [demoStudent, rivalStudent]) {
      await db.teachingGroupMember.upsert({
        where: {
          groupId_userId: {
            groupId: teachingGroup.id,
            userId: student.id,
          },
        },
        update: { memberRole: "student", status: "active" },
        create: {
          groupId: teachingGroup.id,
          userId: student.id,
          memberRole: "student",
          status: "active",
        },
      })
    }

    await db.teachingGroupProblemSetAssignment.upsert({
      where: {
        groupId_problemSetId: {
          groupId: teachingGroup.id,
          problemSetId: dpProblemSet.id,
        },
      },
      update: {
        status: "active",
        title: "Seed 动态规划作业",
        note: "用于演示班级统计和作业成绩。",
        dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        maxScore: 100,
        gradingMode: "auto",
        publishedAt: new Date(),
        assignedById: demoTeacher.id,
      },
      create: {
        groupId: teachingGroup.id,
        problemSetId: dpProblemSet.id,
        assignedById: demoTeacher.id,
        status: "active",
        title: "Seed 动态规划作业",
        note: "用于演示班级统计和作业成绩。",
        dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        maxScore: 100,
        gradingMode: "auto",
        publishedAt: new Date(),
      },
    })

    const camp = await db.camp.upsert({
      where: { slug: "seed-dp-camp" },
      update: {
        title: "Seed 动态规划训练营",
        summary: "用于演示训练营报名、打卡、排行和结营报告。",
        description: "最小可用训练营样本。",
        suitableFor: "已经完成基础搜索与入门动态规划的学生",
        difficulty: "intermediate",
        status: "published",
        visibility: "public",
        accessLevel: "purchase",
        highlights: asJson(["每日任务", "打卡", "排行榜", "结营报告"]),
      },
      create: {
        slug: "seed-dp-camp",
        title: "Seed 动态规划训练营",
        summary: "用于演示训练营报名、打卡、排行和结营报告。",
        description: "最小可用训练营样本。",
        suitableFor: "已经完成基础搜索与入门动态规划的学生",
        difficulty: "intermediate",
        status: "published",
        visibility: "public",
        accessLevel: "purchase",
        highlights: asJson(["每日任务", "打卡", "排行榜", "结营报告"]),
      },
    })

    const campClass = await db.campClass.upsert({
      where: { slug: "seed-dp-camp-class" },
      update: {
        campId: camp.id,
        teachingGroupId: teachingGroup.id,
        title: "Seed 动态规划营 1 班",
        summary: "用于演示训练营班级页和营内任务。",
        coachName: demoTeacher.name,
        status: "active",
        visibility: "public",
        accessLevel: "purchase",
        enrollStartAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        enrollEndAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        capacity: 30,
      },
      create: {
        slug: "seed-dp-camp-class",
        campId: camp.id,
        teachingGroupId: teachingGroup.id,
        title: "Seed 动态规划营 1 班",
        summary: "用于演示训练营班级页和营内任务。",
        coachName: demoTeacher.name,
        status: "active",
        visibility: "public",
        accessLevel: "purchase",
        enrollStartAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        enrollEndAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        capacity: 30,
      },
    })

    const campProduct = await ensureProductWithSku({
      slug: "seed-dp-camp-pass",
      name: "Seed 动态规划训练营报名",
      summary: "用于演示训练营下单、权益和班级访问。",
      description: "购买后进入 Seed 动态规划训练营班级。",
      type: "camp",
      targetType: "camp",
      targetId: camp.id,
      validDays: 30,
      priceCents: 19900,
      tags: ["训练营", "动态规划"],
      sku: {
        skuCode: "camp-standard",
        name: "1 班标准席位",
        description: "Seed 动态规划营 1 班标准席位。",
        priceCents: 19900,
        originalPriceCents: 29900,
        validDays: 30,
      },
      benefits: [
        { title: "营内任务", description: "解锁每日任务和班级页。" },
        { title: "营内排行", description: "可查看班级排行榜与结营报告。" },
      ],
    })

    await db.campSku.upsert({
      where: { productSkuId: campProduct.sku.id },
      update: {
        campId: camp.id,
        classId: campClass.id,
        productId: campProduct.product.id,
        label: "标准席位",
        status: "active",
        isDefault: true,
      },
      create: {
        campId: camp.id,
        classId: campClass.id,
        productId: campProduct.product.id,
        productSkuId: campProduct.sku.id,
        label: "标准席位",
        status: "active",
        isDefault: true,
      },
    })

    const campTaskSeeds = [
      {
        dayIndex: 1,
        title: "Day 1：爬楼梯状态定义",
        problem: ensuredProblems.get("stairs-dp"),
      },
      {
        dayIndex: 2,
        title: "Day 2：01 背包状态转移",
        problem: ensuredProblems.get("bag-dp"),
      },
      {
        dayIndex: 3,
        title: "Day 3：并查集与图论补充",
        problem: ensuredProblems.get("union-find"),
      },
    ]

    for (const taskSeed of campTaskSeeds) {
      if (!taskSeed.problem) continue
      const taskDate = new Date(Date.now() - (4 - taskSeed.dayIndex) * 24 * 60 * 60 * 1000)
      const existingTask = await db.campTask.findFirst({
        where: {
          classId: campClass.id,
          title: taskSeed.title,
        },
      })

      if (existingTask) {
        await db.campTask.update({
          where: { id: existingTask.id },
          data: {
            campId: camp.id,
            taskDate,
            dayIndex: taskSeed.dayIndex,
            status: "published",
            resourceType: "problem",
            resourceId: taskSeed.problem.id,
            problemId: taskSeed.problem.id,
            points: 100,
            isRequired: true,
            sortOrder: taskSeed.dayIndex,
          },
        })
      } else {
        await db.campTask.create({
          data: {
            campId: camp.id,
            classId: campClass.id,
            title: taskSeed.title,
            summary: "Seed 训练营每日任务",
            description: "用于演示打卡、任务和排行榜。",
            taskDate,
            dayIndex: taskSeed.dayIndex,
            status: "published",
            resourceType: "problem",
            resourceId: taskSeed.problem.id,
            problemId: taskSeed.problem.id,
            points: 100,
            isRequired: true,
            sortOrder: taskSeed.dayIndex,
          },
        })
      }
    }

    const vipPurchase = await ensureCompletedOrder({
      orderNo: "SEED-VIP-DEMO-STUDENT",
      paymentNo: "PAY-SEED-VIP-DEMO-STUDENT",
      userId: demoStudent.id,
      productId: membershipProduct.id,
      skuId: membershipDefaultSku.id,
      amountCents: membershipDefaultSku.priceCents,
      productName: membershipProduct.name,
      skuName: membershipDefaultSku.name,
      validDays: membershipDefaultSku.validDays ?? membershipProduct.validDays,
      paidAt: new Date(),
    })

    const vipExpiresAt = new Date(Date.now() + ((membershipDefaultSku.validDays ?? 30) * 24 * 60 * 60 * 1000))
    await ensureEntitlement({
      userId: demoStudent.id,
      productId: membershipProduct.id,
      sourceId: vipPurchase.order.id,
      expiresAt: vipExpiresAt,
    })
    await ensureMembershipForUser({
      userId: demoStudent.id,
      productId: membershipProduct.id,
      skuId: membershipDefaultSku.id,
      orderId: vipPurchase.order.id,
      startedAt: vipPurchase.order.paidAt ?? new Date(),
      expiresAt: vipExpiresAt,
    })

    const contentPackPurchase = await ensureCompletedOrder({
      orderNo: "SEED-CONTENT-PACK-DEMO-STUDENT",
      paymentNo: "PAY-SEED-CONTENT-PACK-DEMO-STUDENT",
      userId: demoStudent.id,
      productId: contentPack.product.id,
      skuId: contentPack.sku.id,
      amountCents: contentPack.sku.priceCents,
      productName: contentPack.product.name,
      skuName: contentPack.sku.name,
      validDays: contentPack.sku.validDays,
      paidAt: new Date(),
    })
    await ensureEntitlement({
      userId: demoStudent.id,
      productId: contentPack.product.id,
      sourceId: contentPackPurchase.order.id,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })

    const contestPurchase = await ensureCompletedOrder({
      orderNo: "SEED-CONTEST-REVIEW-DEMO-STUDENT",
      paymentNo: "PAY-SEED-CONTEST-REVIEW-DEMO-STUDENT",
      userId: demoStudent.id,
      productId: reviewContestProduct.product.id,
      skuId: reviewContestProduct.sku.id,
      amountCents: reviewContestProduct.sku.priceCents,
      productName: reviewContestProduct.product.name,
      skuName: reviewContestProduct.sku.name,
      validDays: reviewContestProduct.sku.validDays,
      paidAt: finishedContestEnd,
    })
    await ensureEntitlement({
      userId: demoStudent.id,
      productId: reviewContestProduct.product.id,
      sourceId: contestPurchase.order.id,
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    })

    await db.contestRegistration.upsert({
      where: {
        contestId_userId: {
          contestId: finishedContest.id,
          userId: demoStudent.id,
        },
      },
      update: {
        orderId: contestPurchase.order.id,
        status: "JOINED",
        sourceType: "PURCHASE",
        sourceId: contestPurchase.order.id,
        groupKey: "seed",
        groupLabel: "Seed 组",
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
      create: {
        contestId: finishedContest.id,
        userId: demoStudent.id,
        orderId: contestPurchase.order.id,
        status: "JOINED",
        sourceType: "PURCHASE",
        sourceId: contestPurchase.order.id,
        groupKey: "seed",
        groupLabel: "Seed 组",
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
    })

    await db.contestParticipant.upsert({
      where: {
        contestId_userId: {
          contestId: finishedContest.id,
          userId: demoStudent.id,
        },
      },
      update: {
        orderId: contestPurchase.order.id,
        status: "JOINED",
        sourceType: "PURCHASE",
        sourceId: contestPurchase.order.id,
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
      create: {
        contestId: finishedContest.id,
        userId: demoStudent.id,
        orderId: contestPurchase.order.id,
        status: "JOINED",
        sourceType: "PURCHASE",
        sourceId: contestPurchase.order.id,
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
    })

    await db.contestRegistration.upsert({
      where: {
        contestId_userId: {
          contestId: finishedContest.id,
          userId: rivalStudent.id,
        },
      },
      update: {
        status: "JOINED",
        sourceType: "ACTIVITY",
        sourceId: "seed",
        groupKey: "seed",
        groupLabel: "Seed 组",
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
      create: {
        contestId: finishedContest.id,
        userId: rivalStudent.id,
        status: "JOINED",
        sourceType: "ACTIVITY",
        sourceId: "seed",
        groupKey: "seed",
        groupLabel: "Seed 组",
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
    })

    await db.contestParticipant.upsert({
      where: {
        contestId_userId: {
          contestId: finishedContest.id,
          userId: rivalStudent.id,
        },
      },
      update: {
        status: "JOINED",
        sourceType: "ACTIVITY",
        sourceId: "seed",
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
      create: {
        contestId: finishedContest.id,
        userId: rivalStudent.id,
        status: "JOINED",
        sourceType: "ACTIVITY",
        sourceId: "seed",
        joinedAt: finishedContestStart,
        paidAt: finishedContestEnd,
      },
    })

    const campPurchase = await ensureCompletedOrder({
      orderNo: "SEED-CAMP-DEMO-STUDENT",
      paymentNo: "PAY-SEED-CAMP-DEMO-STUDENT",
      userId: demoStudent.id,
      productId: campProduct.product.id,
      skuId: campProduct.sku.id,
      amountCents: campProduct.sku.priceCents,
      productName: campProduct.product.name,
      skuName: campProduct.sku.name,
      validDays: campProduct.sku.validDays,
      paidAt: new Date(),
    })
    await ensureEntitlement({
      userId: demoStudent.id,
      productId: campProduct.product.id,
      sourceId: campPurchase.order.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    const campSku = await db.campSku.findUnique({
      where: { productSkuId: campProduct.sku.id },
    })

    if (!campSku) {
      return NextResponse.json({ ok: false, error: "camp_sku_missing" }, { status: 500 })
    }

    await db.campEnrollment.upsert({
      where: {
        classId_userId: {
          classId: campClass.id,
          userId: demoStudent.id,
        },
      },
      update: {
        campId: camp.id,
        campSkuId: campSku.id,
        orderId: campPurchase.order.id,
        status: "ACTIVE",
        sourceType: "PURCHASE",
        sourceId: campPurchase.order.id,
        enrolledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(),
      },
      create: {
        campId: camp.id,
        classId: campClass.id,
        campSkuId: campSku.id,
        userId: demoStudent.id,
        orderId: campPurchase.order.id,
        status: "ACTIVE",
        sourceType: "PURCHASE",
        sourceId: campPurchase.order.id,
        enrolledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(),
      },
    })

    await db.campEnrollment.upsert({
      where: {
        classId_userId: {
          classId: campClass.id,
          userId: rivalStudent.id,
        },
      },
      update: {
        campId: camp.id,
        campSkuId: campSku.id,
        status: "ACTIVE",
        sourceType: "ACTIVITY",
        sourceId: "seed",
        enrolledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(),
      },
      create: {
        campId: camp.id,
        classId: campClass.id,
        campSkuId: campSku.id,
        userId: rivalStudent.id,
        status: "ACTIVE",
        sourceType: "ACTIVITY",
        sourceId: "seed",
        enrolledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(),
      },
    })

    const activeCampEnrollments = await db.campEnrollment.findMany({
      where: {
        classId: campClass.id,
        userId: {
          in: [demoStudent.id, rivalStudent.id],
        },
      },
      select: {
        id: true,
        userId: true,
      },
    })
    const enrollmentMap = new Map(activeCampEnrollments.map((item) => [item.userId, item.id]))

    const campTasks = await db.campTask.findMany({
      where: { classId: campClass.id },
      orderBy: [{ dayIndex: "asc" }, { sortOrder: "asc" }],
    })

    for (const task of campTasks) {
      if (enrollmentMap.get(demoStudent.id)) {
        await db.campCheckin.upsert({
          where: {
            taskId_userId: {
              taskId: task.id,
              userId: demoStudent.id,
            },
          },
          update: {
            campId: camp.id,
            classId: campClass.id,
            enrollmentId: enrollmentMap.get(demoStudent.id)!,
            status: "checked_in",
            note: "Seed 学员已完成打卡",
            checkinAt: task.taskDate,
          },
          create: {
            campId: camp.id,
            classId: campClass.id,
            taskId: task.id,
            enrollmentId: enrollmentMap.get(demoStudent.id)!,
            userId: demoStudent.id,
            status: "checked_in",
            note: "Seed 学员已完成打卡",
            checkinAt: task.taskDate,
          },
        })
      }
    }

    await db.guardianRelation.upsert({
      where: {
        guardianUserId_studentUserId: {
          guardianUserId: demoParent.id,
          studentUserId: demoStudent.id,
        },
      },
      update: {
        relation: "parent",
        status: "active",
        note: "Seed 家长绑定关系",
      },
      create: {
        guardianUserId: demoParent.id,
        studentUserId: demoStudent.id,
        relation: "parent",
        status: "active",
        note: "Seed 家长绑定关系",
      },
    })

    const studyGroup = await db.studyGroup.upsert({
      where: { slug: "seed-study-group" },
      update: {
        ownerId: demoTeacher.id,
        name: "Seed 动态规划学习小组",
        summary: "用于演示社区与讨论区的最小小组数据。",
        description: "成员会分享打卡、训练营和模拟赛复盘。",
        topic: "动态规划",
        level: "intermediate",
        visibility: "public",
        status: "active",
        memberLimit: 50,
      },
      create: {
        slug: "seed-study-group",
        ownerId: demoTeacher.id,
        name: "Seed 动态规划学习小组",
        summary: "用于演示社区与讨论区的最小小组数据。",
        description: "成员会分享打卡、训练营和模拟赛复盘。",
        topic: "动态规划",
        level: "intermediate",
        visibility: "public",
        status: "active",
        memberLimit: 50,
      },
    })

    for (const member of [demoTeacher, demoStudent, rivalStudent]) {
      await db.studyGroupMember.upsert({
        where: {
          groupId_userId: {
            groupId: studyGroup.id,
            userId: member.id,
          },
        },
        update: {
          role: member.id === demoTeacher.id ? "owner" : "member",
          status: "active",
        },
        create: {
          groupId: studyGroup.id,
          userId: member.id,
          role: member.id === demoTeacher.id ? "owner" : "member",
          status: "active",
        },
      })
    }

    const post = await db.post.upsert({
      where: { id: "seed-community-post" },
      update: {
        userId: demoStudent.id,
        groupId: studyGroup.id,
        kind: "achievement",
        visibility: "public",
        title: "Seed 学员完成了动态规划训练",
        content: "今天完成了 01 背包和爬楼梯两道题，准备继续刷训练营 Day 3。",
        status: "approved",
        metadata: asJson({ source: "seed" }),
      },
      create: {
        id: "seed-community-post",
        userId: demoStudent.id,
        groupId: studyGroup.id,
        kind: "achievement",
        visibility: "public",
        title: "Seed 学员完成了动态规划训练",
        content: "今天完成了 01 背包和爬楼梯两道题，准备继续刷训练营 Day 3。",
        status: "approved",
        metadata: asJson({ source: "seed" }),
      },
    })

    const existingComment = await db.comment.findFirst({
      where: {
        postId: post.id,
        userId: rivalStudent.id,
        content: "一起冲！我也在看这场模拟赛的赛后报告。",
      },
    })
    if (!existingComment) {
      await db.comment.create({
        data: {
          postId: post.id,
          userId: rivalStudent.id,
          content: "一起冲！我也在看这场模拟赛的赛后报告。",
          status: "approved",
        },
      })
    }

    const rewardProduct = await ensureProductWithSku({
      slug: "seed-reward-pack",
      name: "Seed 积分兑换题解包",
      summary: "用于演示积分商城和奖励兑换。",
      description: "社区互动积分可兑换的示例商品。",
      type: "reward",
      priceCents: 0,
      tags: ["积分", "奖励"],
      metadata: {
        rewardPointsCost: 200,
      },
      sku: {
        skuCode: "reward-standard",
        name: "积分兑换版",
        description: "仅用于积分兑换演示。",
        priceCents: 0,
      },
      benefits: [
        { title: "积分兑换演示", description: "展示奖励商品列表。" },
      ],
    })

    const demoPoints = [
      {
        actionType: "seed_signup",
        actionKey: "seed-points-signup-demo-student",
        pointsDelta: 120,
        balanceAfter: 120,
        relatedType: "user",
        relatedId: demoStudent.id,
        note: "Seed 注册奖励",
      },
      {
        actionType: "seed_post",
        actionKey: "seed-points-post-demo-student",
        pointsDelta: 80,
        balanceAfter: 200,
        relatedType: "post",
        relatedId: post.id,
        note: "Seed 发帖奖励",
      },
    ]

    for (const transaction of demoPoints) {
      await db.pointTransaction.upsert({
        where: { actionKey: transaction.actionKey },
        update: {
          userId: demoStudent.id,
          actionType: transaction.actionType,
          pointsDelta: transaction.pointsDelta,
          balanceAfter: transaction.balanceAfter,
          relatedType: transaction.relatedType,
          relatedId: transaction.relatedId,
          note: transaction.note,
        },
        create: {
          userId: demoStudent.id,
          actionType: transaction.actionType,
          actionKey: transaction.actionKey,
          pointsDelta: transaction.pointsDelta,
          balanceAfter: transaction.balanceAfter,
          relatedType: transaction.relatedType,
          relatedId: transaction.relatedId,
          note: transaction.note,
        },
      })
    }

    await db.user.update({
      where: { id: demoStudent.id },
      data: { pointsBalance: 200 },
    })

    await db.pointRedemption.upsert({
      where: { id: "seed-point-redemption-demo-student" },
      update: {
        userId: demoStudent.id,
        productId: rewardProduct.product.id,
        pointsCost: 200,
        status: "completed",
        note: "Seed 积分兑换记录",
      },
      create: {
        id: "seed-point-redemption-demo-student",
        userId: demoStudent.id,
        productId: rewardProduct.product.id,
        pointsCost: 200,
        status: "completed",
        note: "Seed 积分兑换记录",
      },
    })

    await db.submission.deleteMany({
      where: {
        userId: {
          in: [demoStudent.id, rivalStudent.id],
        },
        code: {
          contains: "// seed-demo",
        },
      },
    })

    const demoStudentContestSubmission = await ensureSubmission({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("string-palindrome")!.id,
      versionId: ensuredProblems.get("string-palindrome")!.versionId,
      status: "ACCEPTED",
      judgeResult: SubmissionJudgeResult.ACCEPTED,
      score: 100,
      code: "// seed-demo contest accepted 1",
      createdAt: new Date(finishedContestStart.getTime() + 20 * 60 * 1000),
      finishedAt: new Date(finishedContestStart.getTime() + 22 * 60 * 1000),
    })
    await ensureSubmission({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("bag-dp")!.id,
      versionId: ensuredProblems.get("bag-dp")!.versionId,
      status: "WRONG_ANSWER",
      judgeResult: SubmissionJudgeResult.WRONG_ANSWER,
      score: 30,
      code: "// seed-demo contest wrong 2",
      createdAt: new Date(finishedContestStart.getTime() + 65 * 60 * 1000),
      finishedAt: new Date(finishedContestStart.getTime() + 67 * 60 * 1000),
    })
    const demoStudentCampSubmission = await ensureSubmission({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("stairs-dp")!.id,
      versionId: ensuredProblems.get("stairs-dp")!.versionId,
      status: "ACCEPTED",
      judgeResult: SubmissionJudgeResult.ACCEPTED,
      score: 100,
      code: "// seed-demo learning accepted stairs",
      createdAt: DEMO_TIMELINE.threeDaysAgo,
      finishedAt: new Date(DEMO_TIMELINE.threeDaysAgo.getTime() + 2 * 60 * 1000),
    })
    const demoStudentBagSubmission = await ensureSubmission({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("bag-dp")!.id,
      versionId: ensuredProblems.get("bag-dp")!.versionId,
      status: "ACCEPTED",
      judgeResult: SubmissionJudgeResult.ACCEPTED,
      score: 100,
      code: "// seed-demo learning accepted bag",
      createdAt: DEMO_TIMELINE.yesterday,
      finishedAt: new Date(DEMO_TIMELINE.yesterday.getTime() + 3 * 60 * 1000),
    })
    await ensureSubmission({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("maze-bfs")!.id,
      versionId: ensuredProblems.get("maze-bfs")!.versionId,
      status: "WRONG_ANSWER",
      judgeResult: SubmissionJudgeResult.WRONG_ANSWER,
      score: 20,
      code: "// seed-demo learning wrong bfs",
      createdAt: DEMO_TIMELINE.twoDaysAgo,
      finishedAt: new Date(DEMO_TIMELINE.twoDaysAgo.getTime() + 4 * 60 * 1000),
    })
    await ensureSubmission({
      userId: rivalStudent.id,
      problemId: ensuredProblems.get("string-palindrome")!.id,
      versionId: ensuredProblems.get("string-palindrome")!.versionId,
      status: "ACCEPTED",
      judgeResult: SubmissionJudgeResult.ACCEPTED,
      score: 100,
      code: "// seed-demo rival contest accepted 1",
      createdAt: new Date(finishedContestStart.getTime() + 10 * 60 * 1000),
      finishedAt: new Date(finishedContestStart.getTime() + 12 * 60 * 1000),
    })
    await ensureSubmission({
      userId: rivalStudent.id,
      problemId: ensuredProblems.get("bag-dp")!.id,
      versionId: ensuredProblems.get("bag-dp")!.versionId,
      status: "ACCEPTED",
      judgeResult: SubmissionJudgeResult.ACCEPTED,
      score: 100,
      code: "// seed-demo rival contest accepted 2",
      createdAt: new Date(finishedContestStart.getTime() + 45 * 60 * 1000),
      finishedAt: new Date(finishedContestStart.getTime() + 47 * 60 * 1000),
    })
    const rivalCampSubmission = await ensureSubmission({
      userId: rivalStudent.id,
      problemId: ensuredProblems.get("union-find")!.id,
      versionId: ensuredProblems.get("union-find")!.versionId,
      status: "ACCEPTED",
      judgeResult: SubmissionJudgeResult.ACCEPTED,
      score: 100,
      code: "// seed-demo rival camp accepted union-find",
      createdAt: DEMO_TIMELINE.fiveDaysAgo,
      finishedAt: new Date(DEMO_TIMELINE.fiveDaysAgo.getTime() + 2 * 60 * 1000),
    })

    await ensureUserProblemProgress({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("stairs-dp")!.id,
      status: UserProblemStatus.ACCEPTED,
      attempts: 2,
      bestScore: 100,
      lastStatus: "ACCEPTED",
      solvedAt: demoStudentCampSubmission.finishedAt ?? DEMO_TIMELINE.threeDaysAgo,
      lastSubmissionId: demoStudentCampSubmission.id,
      updatedAt: demoStudentCampSubmission.finishedAt ?? DEMO_TIMELINE.threeDaysAgo,
    })
    await ensureUserProblemProgress({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("bag-dp")!.id,
      status: UserProblemStatus.ACCEPTED,
      attempts: 3,
      bestScore: 100,
      lastStatus: "ACCEPTED",
      solvedAt: demoStudentBagSubmission.finishedAt ?? DEMO_TIMELINE.yesterday,
      lastSubmissionId: demoStudentBagSubmission.id,
      updatedAt: demoStudentBagSubmission.finishedAt ?? DEMO_TIMELINE.yesterday,
    })
    await ensureUserProblemProgress({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("maze-bfs")!.id,
      status: UserProblemStatus.ATTEMPTED,
      attempts: 1,
      bestScore: 20,
      lastStatus: "WRONG_ANSWER",
      lastSubmissionId: null,
      updatedAt: DEMO_TIMELINE.twoDaysAgo,
    })
    await ensureUserProblemProgress({
      userId: demoStudent.id,
      problemId: ensuredProblems.get("string-palindrome")!.id,
      status: UserProblemStatus.ACCEPTED,
      attempts: 1,
      bestScore: 100,
      lastStatus: "ACCEPTED",
      solvedAt: demoStudentContestSubmission.finishedAt ?? finishedContestStart,
      lastSubmissionId: demoStudentContestSubmission.id,
      updatedAt: demoStudentContestSubmission.finishedAt ?? finishedContestStart,
    })
    await ensureUserProblemProgress({
      userId: rivalStudent.id,
      problemId: ensuredProblems.get("union-find")!.id,
      status: UserProblemStatus.ACCEPTED,
      attempts: 1,
      bestScore: 100,
      lastStatus: "ACCEPTED",
      solvedAt: rivalCampSubmission.finishedAt ?? DEMO_TIMELINE.fiveDaysAgo,
      lastSubmissionId: rivalCampSubmission.id,
      updatedAt: rivalCampSubmission.finishedAt ?? DEMO_TIMELINE.fiveDaysAgo,
    })

    await refreshProblemStats([...ensuredProblems.values()].map((item) => item.id))

    await ensureWorkflowLog({
      resourceType: "solution",
      resourceId: ensuredProblems.get("bag-dp")?.premiumSolutionId ?? ensuredProblems.get("bag-dp")!.id,
      fromStatus: "draft",
      toStatus: "published",
      action: "seed_publish",
      note: "生成高级题解与视频解析演示数据",
      operatorId: admin.id,
    })

      logger.info("seed_completed", {
        adminId: admin.id,
        userCount: DEMO_USERS.length,
        pathCount: 6,
        upcomingContestSlug: upcomingContest.slug,
        finishedContestSlug: finishedContest.slug,
        campSlug: camp.slug,
        contentPackSlug: contentPack.product.slug,
        organizationSlug: organization.slug,
      })

      return NextResponse.json({
        ok: true,
        message: "seed_ready",
        users: DEMO_USERS.map((item) => ({
          email: item.email,
          password: item.password,
          roles: item.roles,
        })),
        paths: ["intro", "search", "dynamic-programming", "graph-theory", "advanced-algorithms", "interview-prep"],
        contests: {
          upcoming: upcomingContest.slug,
          finished: finishedContest.slug,
        },
        camp: {
          slug: camp.slug,
          classSlug: campClass.slug,
        },
        contentPack: {
          slug: contentPack.product.slug,
          includedTargetCount: contentPackTargets.length,
        },
        course: {
          slug: videoSeed.course.slug,
          lessonSlug: videoSeed.lesson.slug,
        },
        organization: {
          slug: organization.slug,
          classSlug: teachingGroup.slug,
        },
        community: {
          groupSlug: studyGroup.slug,
          postId: post.id,
        },
        notes: [
          "部署到云服务器后，可用管理员账号调用 POST /api/admin/dev/seed 同步最小可用数据。",
          "demo@student.local 已拥有 VIP、内容包、训练营和赛后复盘通行证，可直接验证解锁链路。",
          "demo@parent.local 可用于验证家长绑定与增强报告，demo@teacher.local 可用于验证班级和后台内容管理。",
        ],
      })
    } catch (error) {
      logger.error("seed_failed", {
        adminId: admin.id,
        error,
      })
      throw error
    }
  },
  { roles: "admin" },
)
