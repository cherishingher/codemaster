import { db } from "@/lib/db"
import type { AuthUser } from "@/lib/authz"

export class DiscussionError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function isDiscussionModerator(user?: Pick<AuthUser, "roles"> | null) {
  return Boolean(user?.roles?.includes("admin") || user?.roles?.includes("moderator"))
}

export function assertDiscussionModerator(user?: AuthUser | null) {
  if (!user || !isDiscussionModerator(user)) {
    throw new DiscussionError("forbidden", "你没有讨论管理权限", 403)
  }
}

export function ensureDiscussionOwnerOrModerator(authorId: string, user?: AuthUser | null) {
  if (!user || (user.id !== authorId && !isDiscussionModerator(user))) {
    throw new DiscussionError("forbidden", "你不能操作这条内容", 403)
  }
}

export function toDiscussionPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function toDiscussionExcerpt(markdown: string, limit = 200) {
  return toDiscussionPlainText(markdown).slice(0, limit)
}

export async function findActiveContestForProblem(problemId: string) {
  const now = new Date()
  return db.contest.findFirst({
    where: {
      startAt: { lte: now },
      endAt: { gte: now },
      status: { in: ["published", "active"] },
      problems: {
        some: {
          problemId,
        },
      },
    },
    orderBy: { endAt: "asc" },
    select: {
      id: true,
      endAt: true,
      name: true,
    },
  })
}
