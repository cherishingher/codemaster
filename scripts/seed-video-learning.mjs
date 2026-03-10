#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const VIDEO_MEMBERSHIP = {
  name: "视频学习付费版",
  priceCents: 29900,
  type: "video_membership",
  validDays: 365,
};

const SAMPLE_VIDEOS = {
  intro: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  algorithm:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  advanced: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
};

const catalog = [
  {
    slug: "cpp-beginner-bootcamp",
    title: "C++ 零基础入门营",
    summary: "从语法、输入输出到顺序结构，先把最基础的写题能力搭起来。",
    description:
      "适合刚开始接触信息学和 OJ 的学生。前两节开放试看，后续章节作为付费版内容解锁。",
    category: "编程入门",
    coverImage: null,
    sections: [
      {
        slug: "cpp-setup-and-io",
        title: "环境与输入输出",
        description: "先把本地开发、OJ 提交和输入输出格式理解清楚。",
        lessons: [
          {
            slug: "cpp-hello-oj",
            title: "认识 OJ 与第一份 C++ 程序",
            type: "video",
            summary: "理解提交评测流程，写出第一份可运行的 C++ 程序。",
            content:
              "这一节先讲最基础的编译、运行和 OJ 提交流程，帮助学生建立完整的做题闭环。",
            assetUri: SAMPLE_VIDEOS.intro,
            thumbnailUrl: null,
            durationSec: 11 * 60,
            isPreview: true,
          },
          {
            slug: "cpp-cin-cout",
            title: "cin / cout 与格式化输出",
            type: "video",
            summary: "掌握常见输入输出写法，避免读题后第一步就出错。",
            content:
              "重点覆盖 cin、cout、endl、空格和换行处理，以及做题时最常见的输出错误。",
            assetUri: SAMPLE_VIDEOS.intro,
            thumbnailUrl: null,
            durationSec: 14 * 60,
            isPreview: true,
          },
          {
            slug: "cpp-variable-and-types",
            title: "变量、类型与运算符",
            type: "video",
            summary: "进入正式编码训练，覆盖 int、long long、double 等基础概念。",
            content:
              "这一节开始进入会员内容，会讲变量声明、常量、表达式优先级和类型选择。",
            assetUri: SAMPLE_VIDEOS.algorithm,
            thumbnailUrl: null,
            durationSec: 18 * 60,
            isPreview: false,
          },
        ],
      },
      {
        slug: "cpp-branch-and-loop",
        title: "分支与循环",
        description: "用 if / for / while 解决第一批入门题。",
        lessons: [
          {
            slug: "cpp-if-else-practice",
            title: "条件判断与分支练习",
            type: "video",
            summary: "从范围分类、大小比较到多重条件判断。",
            content:
              "讲清楚 if / else if / else 的书写习惯，以及如何把文字条件翻译成代码。",
            assetUri: SAMPLE_VIDEOS.algorithm,
            thumbnailUrl: null,
            durationSec: 20 * 60,
            isPreview: false,
          },
          {
            slug: "cpp-loop-basics",
            title: "for / while 循环入门",
            type: "video",
            summary: "建立“重复操作”的思维模型，开始接触计数与累加。",
            content:
              "配合 OJ 入门题讲解循环控制、边界和常见死循环问题。",
            assetUri: SAMPLE_VIDEOS.algorithm,
            thumbnailUrl: null,
            durationSec: 16 * 60,
            isPreview: false,
          },
        ],
      },
    ],
  },
  {
    slug: "algorithm-thinking-map",
    title: "算法思维图谱",
    summary: "从枚举、模拟到贪心和前缀和，用视频把题型思路拆清楚。",
    description:
      "偏向题型方法论的课程。开放一节试看课，后面逐步串起算法训练所需的分析套路。",
    category: "算法专题",
    coverImage: null,
    sections: [
      {
        slug: "algorithm-enumeration",
        title: "枚举与模拟",
        description: "很多入门题的关键不在复杂算法，而在于把过程写对。",
        lessons: [
          {
            slug: "algorithm-enumeration-preview",
            title: "枚举题为什么适合新手建立信心",
            type: "video",
            summary: "先从最稳定的枚举模型开始，学会完整地拆问题。",
            content:
              "这一节会讲如何判断一道题能不能直接枚举，复杂度大概怎么估算。",
            assetUri: SAMPLE_VIDEOS.intro,
            thumbnailUrl: null,
            durationSec: 13 * 60,
            isPreview: true,
          },
          {
            slug: "algorithm-simulation-template",
            title: "模拟题的代码组织模板",
            type: "video",
            summary: "把题目过程翻译成代码时，如何避免把自己写乱。",
            content:
              "讲状态设计、过程拆分和调试顺序，减少模拟题里最常见的逻辑错误。",
            assetUri: SAMPLE_VIDEOS.advanced,
            thumbnailUrl: null,
            durationSec: 22 * 60,
            isPreview: false,
          },
        ],
      },
      {
        slug: "algorithm-greedy-prefix",
        title: "贪心与前缀和",
        description: "开始进入中阶训练常见题型。",
        lessons: [
          {
            slug: "algorithm-greedy-entry",
            title: "贪心策略成立的直觉",
            type: "video",
            summary: "不是所有看起来局部最优的题都能贪心，需要建立判断标准。",
            content:
              "结合几个典型题型讲贪心策略为什么可行，以及如何快速自证正确性。",
            assetUri: SAMPLE_VIDEOS.advanced,
            thumbnailUrl: null,
            durationSec: 26 * 60,
            isPreview: false,
          },
          {
            slug: "algorithm-prefix-sum",
            title: "前缀和解决区间统计",
            type: "video",
            summary: "把重复统计的问题提前预处理，降低每次查询成本。",
            content:
              "适合和 OJ 里的区间求和、计数题一起搭配训练。",
            assetUri: SAMPLE_VIDEOS.advanced,
            thumbnailUrl: null,
            durationSec: 19 * 60,
            isPreview: false,
          },
        ],
      },
    ],
  },
  {
    slug: "contest-sprint-review",
    title: "赛前冲刺与复盘",
    summary: "围绕比赛节奏、做题顺序和赛后复盘，做一套更偏实战的课程。",
    description:
      "适合已经开始打比赛的学生。整门课都作为付费内容，用于承载更高密度的复盘视频。",
    category: "赛前提升",
    coverImage: null,
    sections: [
      {
        slug: "contest-before-match",
        title: "赛前准备",
        description: "比赛前一天和开赛前 10 分钟该准备什么。",
        lessons: [
          {
            slug: "contest-setup-checklist",
            title: "比赛前的环境与心态清单",
            type: "video",
            summary: "不只是算法准备，比赛前的状态管理也很关键。",
            content:
              "包含设备、模板、补给和心态四个部分，帮助学生建立稳定比赛习惯。",
            assetUri: SAMPLE_VIDEOS.algorithm,
            thumbnailUrl: null,
            durationSec: 17 * 60,
            isPreview: false,
          },
        ],
      },
      {
        slug: "contest-after-match",
        title: "赛后复盘",
        description: "比赛真正拉开差距的地方，往往在赛后复盘。",
        lessons: [
          {
            slug: "contest-replay-method",
            title: "如何做一份真正有价值的赛后复盘",
            type: "video",
            summary: "从错题分类、时间分配到下一轮训练计划。",
            content:
              "讲如何把比赛结果沉淀成下一阶段可执行的训练清单，而不是只看排名。",
            assetUri: SAMPLE_VIDEOS.advanced,
            thumbnailUrl: null,
            durationSec: 21 * 60,
            isPreview: false,
          },
        ],
      },
    ],
  },
];

async function ensureMembershipProduct() {
  const existing = await db.product.findFirst({
    where: { type: VIDEO_MEMBERSHIP.type },
    orderBy: { priceCents: "asc" },
  });

  if (existing) {
    return db.product.update({
      where: { id: existing.id },
      data: VIDEO_MEMBERSHIP,
    });
  }

  return db.product.create({
    data: VIDEO_MEMBERSHIP,
  });
}

async function upsertLesson(sectionId, lesson, sortOrder) {
  return db.lesson.upsert({
    where: { slug: lesson.slug },
    create: {
      slug: lesson.slug,
      sectionId,
      title: lesson.title,
      type: lesson.type,
      summary: lesson.summary,
      content: lesson.content,
      thumbnailUrl: lesson.thumbnailUrl,
      assetUri: lesson.assetUri,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      sortOrder,
    },
    update: {
      sectionId,
      title: lesson.title,
      type: lesson.type,
      summary: lesson.summary,
      content: lesson.content,
      thumbnailUrl: lesson.thumbnailUrl,
      assetUri: lesson.assetUri,
      durationSec: lesson.durationSec,
      isPreview: lesson.isPreview,
      sortOrder,
    },
  });
}

async function upsertSection(courseId, section, sortOrder) {
  return db.section.upsert({
    where: { slug: section.slug },
    create: {
      slug: section.slug,
      courseId,
      title: section.title,
      description: section.description,
      sortOrder,
    },
    update: {
      courseId,
      title: section.title,
      description: section.description,
      sortOrder,
    },
  });
}

async function upsertCourse(course, sortOrder) {
  return db.course.upsert({
    where: { slug: course.slug },
    create: {
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      description: course.description,
      category: course.category,
      coverImage: course.coverImage,
      status: "published",
      sortOrder,
    },
    update: {
      title: course.title,
      summary: course.summary,
      description: course.description,
      category: course.category,
      coverImage: course.coverImage,
      status: "published",
      sortOrder,
    },
  });
}

async function main() {
  const product = await ensureMembershipProduct();
  let sectionCount = 0;
  let lessonCount = 0;

  for (const [courseIndex, course] of catalog.entries()) {
    const courseRow = await upsertCourse(course, courseIndex);

    for (const [sectionIndex, section] of course.sections.entries()) {
      const sectionRow = await upsertSection(courseRow.id, section, sectionIndex);
      sectionCount += 1;

      for (const [lessonIndex, lesson] of section.lessons.entries()) {
        await upsertLesson(sectionRow.id, lesson, lessonIndex);
        lessonCount += 1;
      }
    }
  }

  const courseTotal = await db.course.count({ where: { status: "published" } });
  const previewTotal = await db.lesson.count({ where: { isPreview: true } });

  console.log("视频学习演示数据写入完成:");
  console.log(`- 会员商品: ${product.name} (${product.priceCents} cents)`);
  console.log(`- 已发布课程: ${courseTotal}`);
  console.log(`- 本次处理章节: ${sectionCount}`);
  console.log(`- 本次处理视频: ${lessonCount}`);
  console.log(`- 当前试看内容: ${previewTotal}`);
}

main()
  .catch((error) => {
    console.error("写入失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
