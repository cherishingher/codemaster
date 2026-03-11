import { db } from "@/lib/db"
import { UserProblemStatus } from "@/lib/oj"
import type { CampTaskItem } from "@/lib/camps"

type TaskViewer = {
  id?: string | null
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function listCampTasks(
  classId: string,
  viewer?: TaskViewer,
): Promise<CampTaskItem[]> {
  const tasks = await db.campTask.findMany({
    where: {
      classId,
      status: "published",
    },
    include: {
      problem: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
        },
      },
    },
    orderBy: [{ taskDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  })

  if (tasks.length === 0) {
    return []
  }

  const problemIds = tasks.map((task) => task.problemId).filter((item): item is string => Boolean(item))
  const [checkins, progressRows] = viewer?.id
    ? await Promise.all([
        db.campCheckin.findMany({
          where: {
            classId,
            userId: viewer.id,
          },
          select: {
            taskId: true,
          },
        }),
        problemIds.length
          ? db.userProblemProgress.findMany({
              where: {
                userId: viewer.id,
                problemId: { in: problemIds },
              },
              select: {
                problemId: true,
                status: true,
                attempts: true,
              },
            })
          : Promise.resolve([]),
      ])
    : [[], []]

  const checkinSet = new Set(checkins.map((item) => item.taskId))
  const progressMap = new Map(progressRows.map((row) => [row.problemId, row]))
  const now = new Date()

  return tasks.map((task) => {
    const checkedIn = checkinSet.has(task.id)
    const progress = task.problemId ? progressMap.get(task.problemId) ?? null : null
    const solved = Boolean(progress && progress.status >= UserProblemStatus.ACCEPTED)
    const attempted = Boolean(progress && progress.attempts > 0)
    const isUpcoming = task.taskDate.getTime() > now.getTime()

    const completionStatus =
      isUpcoming
        ? "upcoming"
        : checkedIn
          ? "checked_in"
          : solved
            ? "solved"
            : attempted
              ? "in_progress"
              : "todo"

    return {
      id: task.id,
      campId: task.campId,
      classId: task.classId,
      title: task.title,
      summary: task.summary,
      description: task.description,
      taskDate: task.taskDate.toISOString(),
      dayIndex: task.dayIndex,
      status: task.status,
      resourceType: task.resourceType,
      resourceId: task.resourceId,
      points: task.points,
      isRequired: task.isRequired,
      completionStatus,
      checkedIn,
      solved,
      canCheckin: !isUpcoming && !checkedIn && Boolean(viewer?.id),
      problem: task.problem
        ? {
            id: task.problem.id,
            slug: task.problem.slug,
            title: task.problem.title,
            difficulty: task.problem.difficulty,
          }
        : null,
    } satisfies CampTaskItem
  })
}

export async function getCampTaskPreview(classId: string) {
  const tasks = await db.campTask.findMany({
    where: {
      classId,
      status: "published",
    },
    select: {
      id: true,
      title: true,
      summary: true,
      taskDate: true,
      dayIndex: true,
    },
    orderBy: [{ taskDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    take: 5,
  })

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    summary: task.summary,
    taskDate: task.taskDate.toISOString(),
    dayIndex: task.dayIndex,
    dateKey: formatLocalDateKey(task.taskDate),
  }))
}
