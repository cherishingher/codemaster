import { createHash, randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { hashPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { UserProblemStatus } from "@/lib/oj"
import type {
  TenantAssignmentDetail,
  TenantAssignmentGradeRow,
  TenantAssignmentItem,
  TenantApiKeyItem,
  TenantClassDetail,
  TenantClassItem,
  TenantClassStats,
  TenantCreateAssignmentInput,
  TenantCreateApiKeyInput,
  TenantCreateClassInput,
  TenantCreateOrganizationInput,
  TenantCreateUserInput,
  TenantOrganizationItem,
  TenantUpdateAssignmentGradeInput,
} from "@/lib/tenant-admin"
import { getTeachingGroupStats } from "@/server/modules/edu-admin/service"

type Viewer = {
  id: string
  roles: string[]
}

const API_KEY_LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000

export class TenantAdminError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function hashApiKeyToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function mapApiKey(item: {
  id: string
  name: string
  status: string
  expiresAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date
}): TenantApiKeyItem {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    expiresAt: item.expiresAt?.toISOString() ?? null,
    lastUsedAt: item.lastUsedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }
}

function mapOrganization(item: {
  id: string
  slug: string
  name: string
  shortName: string | null
  externalCode: string | null
  type: string
  status: string
  _count: {
    members: number
    teachingGroups: number
  }
  members: Array<{
    role: string
    userId: string
  }>
}, viewerId: string): TenantOrganizationItem {
  const membership = item.members.find((member) => member.userId === viewerId)
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName,
    externalCode: item.externalCode,
    type: item.type,
    status: item.status,
    role: membership?.role || "member",
    memberCount: item._count.members,
    classCount: item._count.teachingGroups,
  }
}

function mapClass(item: {
  id: string
  slug: string
  name: string
  code: string | null
  externalCode: string | null
  status: string
  groupType: string
  owner: {
    id: string
    name: string | null
    email: string | null
  }
  _count: {
    members: number
  }
}): TenantClassItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    code: item.code,
    externalCode: item.externalCode,
    status: item.status,
    groupType: item.groupType,
    memberCount: item._count.members,
    owner: item.owner,
  }
}

function isProgressSolved(row: { status: number; solvedAt: Date | null }) {
  return row.status >= UserProblemStatus.ACCEPTED || Boolean(row.solvedAt)
}

function isProgressAttempted(row: { status: number; attempts?: number }) {
  return row.status >= UserProblemStatus.ATTEMPTED || (row.attempts ?? 0) > 0
}

function roundNumber(value: number) {
  return Number(value.toFixed(1))
}

function mapAssignmentItem(item: {
  id: string
  title: string | null
  status: string
  note: string | null
  dueAt: Date | null
  maxScore: number
  gradingMode: string
  publishedAt: Date | null
  problemSet: {
    id: string
    title: string
    items: Array<{ problemId: string }>
  }
  grades?: Array<{
    finalScore: number
    completionRate: number
    manualScore?: number | null
  }>
}, fallbackTitle?: string): TenantAssignmentItem {
  const gradeRows = item.grades ?? []
  return {
    id: item.id,
    title: item.title || fallbackTitle || item.problemSet.title,
    status: item.status,
    note: item.note,
    dueAt: item.dueAt?.toISOString() ?? null,
    maxScore: item.maxScore,
    gradingMode: item.gradingMode,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    problemSet: {
      id: item.problemSet.id,
      title: item.problemSet.title,
      itemCount: item.problemSet.items.length,
    },
    gradeSummary: {
      studentCount: gradeRows.length,
      gradedCount: gradeRows.filter((row) => row.manualScore != null || row.finalScore > 0 || row.completionRate > 0).length,
      avgScore: gradeRows.length
        ? roundNumber(gradeRows.reduce((sum, row) => sum + row.finalScore, 0) / gradeRows.length)
        : 0,
      avgCompletionRate: gradeRows.length
        ? roundNumber(gradeRows.reduce((sum, row) => sum + row.completionRate, 0) / gradeRows.length)
        : 0,
    },
  }
}

async function ensureRole(client: Prisma.TransactionClient | typeof db, roleName: string) {
  return client.role.upsert({
    where: { name: roleName },
    create: { name: roleName },
    update: {},
  })
}

async function ensureUserRole(client: Prisma.TransactionClient | typeof db, userId: string, roleName: string) {
  const role = await ensureRole(client, roleName)
  await client.userRole.upsert({
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

async function ensureOrganizationMembership(client: Prisma.TransactionClient | typeof db, organizationId: string, userId: string, role: string) {
  await client.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    update: {
      role,
      status: "active",
    },
    create: {
      organizationId,
      userId,
      role,
      status: "active",
    },
  })
}

async function createUserIfNeeded(client: Prisma.TransactionClient | typeof db, input: { name?: string; email?: string; phone?: string }) {
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.trim()
  const existing = await client.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  })

  if (existing) return existing

  if (!email && !phone) {
    throw new TenantAdminError("invalid_user_input", "创建用户时至少需要邮箱或手机号", 400)
  }

  const password = await hashPassword(`Temp#${randomUUID().slice(0, 10)}`)
  return client.user.create({
    data: {
      name: input.name?.trim() || email || phone || "新用户",
      email,
      phone,
      emailVerifiedAt: email ? new Date() : undefined,
      phoneVerifiedAt: phone ? new Date() : undefined,
      password,
      status: "active",
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  })
}

async function requireOrganizationAccess(viewer: Viewer, organizationId: string, roles?: string[]) {
  if (viewer.roles.includes("admin")) {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, name: true, status: true },
    })
    if (!org) throw new TenantAdminError("organization_not_found", "机构不存在", 404)
    return { organizationId, role: "admin" }
  }

  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: viewer.id,
      },
    },
    select: {
      organizationId: true,
      role: true,
      status: true,
    },
  })

  if (!membership || membership.status !== "active") {
    throw new TenantAdminError("forbidden", "无权访问该租户数据", 403)
  }
  if (roles && !roles.includes(membership.role)) {
    throw new TenantAdminError("forbidden", "当前租户角色无权执行该操作", 403)
  }
  return membership
}

async function requireClassInOrganization(organizationId: string, classId: string) {
  const group = await db.teachingGroup.findFirst({
    where: {
      id: classId,
      organizationId,
    },
    select: {
      id: true,
    },
  })
  if (!group) throw new TenantAdminError("class_not_found", "班级不存在或不属于当前租户", 404)
  return group
}

async function requireAssignmentInClass(organizationId: string, classId: string, assignmentId: string) {
  const assignment = await db.teachingGroupProblemSetAssignment.findFirst({
    where: {
      id: assignmentId,
      groupId: classId,
      group: {
        organizationId,
      },
    },
    select: {
      id: true,
      groupId: true,
      maxScore: true,
      gradingMode: true,
      publishedAt: true,
      title: true,
      note: true,
      dueAt: true,
      status: true,
      problemSet: {
        select: {
          id: true,
          title: true,
          items: {
            select: {
              problemId: true,
            },
          },
        },
      },
    },
  })
  if (!assignment) {
    throw new TenantAdminError("assignment_not_found", "作业不存在或不属于当前班级", 404)
  }
  return assignment
}

async function buildAssignmentGradeRows(assignmentId: string) {
  const assignment = await db.teachingGroupProblemSetAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
          members: {
            where: {
              status: "active",
            },
            orderBy: [{ createdAt: "asc" }],
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
      problemSet: {
        select: {
          id: true,
          title: true,
          items: {
            select: {
              problemId: true,
            },
          },
        },
      },
      grades: {
        include: {
          gradedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!assignment) {
    throw new TenantAdminError("assignment_not_found", "作业不存在", 404)
  }

  const problemIds = [...new Set(assignment.problemSet.items.map((item) => item.problemId))]
  const students = assignment.group.members.filter((member) => member.memberRole !== "teacher")
  const studentIds = students.map((member) => member.userId)

  const [progressRows, submissionRows] =
    studentIds.length > 0 && problemIds.length > 0
      ? await Promise.all([
          db.userProblemProgress.findMany({
            where: {
              userId: { in: studentIds },
              problemId: { in: problemIds },
            },
            select: {
              userId: true,
              problemId: true,
              status: true,
              attempts: true,
              solvedAt: true,
              updatedAt: true,
            },
          }),
          db.submission.groupBy({
            by: ["userId"],
            where: {
              userId: { in: studentIds },
              problemId: { in: problemIds },
            },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
        ])
      : [[], []]

  const progressByUser = new Map<string, typeof progressRows>()
  for (const row of progressRows) {
    const list = progressByUser.get(row.userId) ?? []
    list.push(row)
    progressByUser.set(row.userId, list)
  }

  const submissionByUser = new Map(
    submissionRows.map((row) => [
      row.userId,
      {
        submissionCount: row._count._all,
        lastSubmissionAt: row._max.createdAt ?? null,
      },
    ]),
  )

  const gradeByUser = new Map(
    assignment.grades.map((grade) => [
      grade.userId,
      grade,
    ]),
  )

  const rows = students.map((member) => {
    const progress = progressByUser.get(member.userId) ?? []
    const attemptedProblemCount = progress.filter((row) => isProgressAttempted(row)).length
    const solvedProblemCount = progress.filter((row) => isProgressSolved(row)).length
    const completionRate = problemIds.length ? roundNumber((solvedProblemCount / problemIds.length) * 100) : 0
    const autoScore = Math.round((completionRate / 100) * assignment.maxScore)
    const submission = submissionByUser.get(member.userId)
    const existingGrade = gradeByUser.get(member.userId)
    const manualScore = existingGrade?.manualScore ?? null
    const finalScore = manualScore ?? autoScore
    const status =
      problemIds.length === 0
        ? "pending"
        : solvedProblemCount >= problemIds.length
          ? "completed"
          : attemptedProblemCount > 0 || (submission?.submissionCount ?? 0) > 0
            ? "in_progress"
            : "not_started"

    return {
      assignmentId: assignment.id,
      userId: member.userId,
      status,
      autoScore,
      manualScore,
      finalScore,
      maxScore: assignment.maxScore,
      completionRate,
      solvedProblemCount,
      attemptedProblemCount,
      submissionCount: submission?.submissionCount ?? 0,
      lastSubmissionAt: submission?.lastSubmissionAt ?? null,
      feedback: existingGrade?.feedback ?? null,
      gradedAt: existingGrade?.gradedAt ?? null,
      gradedById: existingGrade?.gradedById ?? null,
      user: member.user,
      gradedBy: existingGrade?.gradedBy
        ? {
            id: existingGrade.gradedBy.id,
            name: existingGrade.gradedBy.name,
            email: existingGrade.gradedBy.email,
          }
        : null,
    }
  })

  return {
    assignment,
    rows,
  }
}

async function syncAssignmentGradeRows(
  client: Prisma.TransactionClient | typeof db,
  assignmentId: string,
) {
  const { assignment, rows } = await buildAssignmentGradeRows(assignmentId)

  for (const row of rows) {
    await client.teachingGroupAssignmentGrade.upsert({
      where: {
        assignmentId_userId: {
          assignmentId: row.assignmentId,
          userId: row.userId,
        },
      },
      update: {
        status: row.status,
        autoScore: row.autoScore,
        finalScore: row.manualScore ?? row.autoScore,
        maxScore: row.maxScore,
        completionRate: row.completionRate,
        solvedProblemCount: row.solvedProblemCount,
        attemptedProblemCount: row.attemptedProblemCount,
        submissionCount: row.submissionCount,
        lastSubmissionAt: row.lastSubmissionAt,
      },
      create: {
        assignmentId: row.assignmentId,
        userId: row.userId,
        status: row.status,
        autoScore: row.autoScore,
        manualScore: row.manualScore,
        finalScore: row.manualScore ?? row.autoScore,
        maxScore: row.maxScore,
        completionRate: row.completionRate,
        solvedProblemCount: row.solvedProblemCount,
        attemptedProblemCount: row.attemptedProblemCount,
        submissionCount: row.submissionCount,
        lastSubmissionAt: row.lastSubmissionAt,
        feedback: row.feedback,
        gradedAt: row.gradedAt,
        gradedById: row.gradedById,
      },
    })
  }

  return assignment
}

export async function listViewerOrganizations(viewer: Viewer) {
  if (viewer.roles.includes("admin")) {
    const orgs = await db.organization.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        members: {
          where: { userId: viewer.id },
          select: { userId: true, role: true },
        },
        _count: {
          select: {
            members: true,
            teachingGroups: true,
          },
        },
      },
    })
    return orgs.map((item) => ({
      ...mapOrganization(item, viewer.id),
      role: "admin",
    }))
  }

  const memberships = await db.organizationMember.findMany({
    where: {
      userId: viewer.id,
      status: "active",
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      organization: {
        include: {
          members: {
            where: { userId: viewer.id },
            select: { userId: true, role: true },
          },
          _count: {
            select: {
              members: true,
              teachingGroups: true,
            },
          },
        },
      },
    },
  })

  return memberships.map((item) => mapOrganization(item.organization, viewer.id))
}

export async function createTenantOrganization(viewer: Viewer, input: TenantCreateOrganizationInput) {
  if (!viewer.roles.includes("admin")) {
    throw new TenantAdminError("forbidden", "仅平台管理员可创建租户", 403)
  }

  const slug = input.slug?.trim() || slugify(input.name)
  if (!slug) throw new TenantAdminError("invalid_slug", "机构 slug 不能为空", 400)

  const identifierEmail = input.adminIdentifier.includes("@") ? input.adminIdentifier.toLowerCase() : undefined
  const identifierPhone = !identifierEmail ? input.adminIdentifier.trim() : undefined

  const created = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        slug,
        name: input.name.trim(),
        shortName: input.shortName?.trim() || null,
        externalCode: input.externalCode?.trim() || null,
        type: input.type?.trim() || "institution",
        status: input.status?.trim() || "active",
        description: input.description?.trim() || null,
        contactName: input.contactName?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
      },
    })

    const adminUser = await createUserIfNeeded(tx, {
      name: input.adminName,
      email: identifierEmail,
      phone: identifierPhone,
    })
    await ensureUserRole(tx, adminUser.id, "org_admin")
    await ensureOrganizationMembership(tx, organization.id, adminUser.id, "org_admin")
    return organization
  })

  return created
}

export async function getTenantOrganization(viewer: Viewer, organizationId: string) {
  const access = await requireOrganizationAccess(viewer, organizationId)
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      _count: {
        select: {
          members: true,
          teachingGroups: true,
        },
      },
      members: {
        where: { userId: viewer.id },
        select: {
          userId: true,
          role: true,
        },
      },
      apiKeys:
        access.role === "org_admin" || access.role === "admin"
          ? {
              where: { status: { not: "revoked" } },
              orderBy: [{ createdAt: "desc" }],
              select: {
                id: true,
                name: true,
                status: true,
                expiresAt: true,
                lastUsedAt: true,
                createdAt: true,
              },
            }
          : false,
    },
  })
  if (!organization) throw new TenantAdminError("organization_not_found", "机构不存在", 404)

  return {
    ...mapOrganization(organization, viewer.id),
    apiKeys: Array.isArray(organization.apiKeys) ? organization.apiKeys.map(mapApiKey) : [],
  }
}

export async function listTenantClasses(viewer: Viewer, organizationId: string) {
  await requireOrganizationAccess(viewer, organizationId)
  const groups = await db.teachingGroup.findMany({
    where: {
      organizationId,
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
  })

  return groups.map(mapClass)
}

export async function createTenantClass(viewer: Viewer, organizationId: string, input: TenantCreateClassInput) {
  const access = await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  const slug = input.slug?.trim() || slugify(input.name)
  if (!slug) throw new TenantAdminError("invalid_slug", "班级 slug 不能为空", 400)

  const group = await db.teachingGroup.create({
    data: {
      organizationId,
      ownerId: viewer.id,
      slug,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      externalCode: input.externalCode?.trim() || null,
      groupType: "class",
      status: "active",
      summary: input.summary?.trim() || null,
      startAt: input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: { members: true },
      },
    },
  })

  await db.$transaction(async (tx) => {
    await ensureOrganizationMembership(
      tx,
      organizationId,
      viewer.id,
      access.role === "teacher" ? "teacher" : access.role === "org_admin" ? "org_admin" : "teacher",
    )
    await tx.teachingGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: viewer.id,
        },
      },
      update: {
        memberRole: "teacher",
        status: "active",
      },
      create: {
        groupId: group.id,
        userId: viewer.id,
        memberRole: "teacher",
        status: "active",
      },
    })
  })

  return mapClass(group)
}

export async function getTenantClass(viewer: Viewer, organizationId: string, classId: string): Promise<TenantClassDetail> {
  await requireOrganizationAccess(viewer, organizationId)
  const group = await db.teachingGroup.findFirst({
    where: {
      id: classId,
      organizationId,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      assignments: {
        where: {
          status: {
            not: "archived",
          },
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          grades: {
            select: {
              finalScore: true,
              completionRate: true,
              manualScore: true,
            },
          },
          problemSet: {
            select: {
              id: true,
              title: true,
              items: {
                select: { problemId: true },
              },
            },
          },
        },
      },
      _count: {
        select: { members: true },
      },
    },
  })
  if (!group) throw new TenantAdminError("class_not_found", "班级不存在", 404)

  return {
    ...mapClass(group),
    organization: group.organization!,
    members: group.members.map((member) => ({
      userId: member.userId,
      memberRole: member.memberRole,
      status: member.status,
      user: member.user,
    })),
    assignments: group.assignments.map((assignment) => ({
      ...mapAssignmentItem(assignment),
      gradeSummary: {
        studentCount: assignment.grades.length,
        gradedCount: assignment.grades.filter((row) => row.manualScore != null || row.finalScore > 0 || row.completionRate > 0).length,
        avgScore: assignment.grades.length
          ? roundNumber(assignment.grades.reduce((sum, row) => sum + row.finalScore, 0) / assignment.grades.length)
          : 0,
      },
    })),
  }
}

export async function getTenantClassStats(viewer: Viewer, organizationId: string, classId: string): Promise<TenantClassStats> {
  await requireOrganizationAccess(viewer, organizationId)
  await requireClassInOrganization(organizationId, classId)
  return getTeachingGroupStats(classId)
}

export async function listTenantClassAssignments(
  viewer: Viewer,
  organizationId: string,
  classId: string,
): Promise<TenantAssignmentItem[]> {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  await requireClassInOrganization(organizationId, classId)

  const assignments = await db.teachingGroupProblemSetAssignment.findMany({
    where: {
      groupId: classId,
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      problemSet: {
        select: {
          id: true,
          title: true,
          items: {
            select: {
              problemId: true,
            },
          },
        },
      },
      grades: {
        select: {
          finalScore: true,
          completionRate: true,
          manualScore: true,
        },
      },
    },
  })

  return assignments.map((assignment) => mapAssignmentItem(assignment))
}

export async function createTenantClassAssignment(
  viewer: Viewer,
  organizationId: string,
  classId: string,
  input: TenantCreateAssignmentInput,
) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  await requireClassInOrganization(organizationId, classId)

  const problemSet = await db.problemSet.findUnique({
    where: { id: input.problemSetId },
    select: {
      id: true,
      title: true,
      status: true,
    },
  })
  if (!problemSet || problemSet.status !== "published") {
    throw new TenantAdminError("problem_set_not_found", "题单不存在或未发布", 404)
  }

  const assignment = await db.teachingGroupProblemSetAssignment.create({
    data: {
      groupId: classId,
      problemSetId: input.problemSetId,
      assignedById: viewer.id,
      title: input.title?.trim() || null,
      note: input.note?.trim() || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      maxScore: input.maxScore ?? 100,
      gradingMode: input.gradingMode?.trim() || "auto",
      publishedAt: input.publishNow ? new Date() : null,
      status: input.publishNow ? "published" : "draft",
    },
  }).catch((error: unknown) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new TenantAdminError("assignment_conflict", "当前班级已布置该题单", 409)
    }
    throw error
  })

  await db.$transaction(async (tx) => {
    await syncAssignmentGradeRows(tx, assignment.id)
  })

  return getTenantAssignmentDetail(viewer, organizationId, classId, assignment.id)
}

export async function getTenantAssignmentDetail(
  viewer: Viewer,
  organizationId: string,
  classId: string,
  assignmentId: string,
): Promise<TenantAssignmentDetail> {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  await requireClassInOrganization(organizationId, classId)
  await requireAssignmentInClass(organizationId, classId, assignmentId)

  await db.$transaction(async (tx) => {
    await syncAssignmentGradeRows(tx, assignmentId)
  })

  const assignment = await db.teachingGroupProblemSetAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
        },
      },
      problemSet: {
        select: {
          id: true,
          title: true,
          items: {
            select: {
              problemId: true,
            },
          },
        },
      },
      grades: {
        orderBy: [{ finalScore: "desc" }, { updatedAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          gradedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!assignment || assignment.group.id !== classId || assignment.group.organizationId !== organizationId) {
    throw new TenantAdminError("assignment_not_found", "作业不存在", 404)
  }

  const grades: TenantAssignmentGradeRow[] = assignment.grades.map((grade) => ({
    userId: grade.userId,
    name: grade.user.name,
    email: grade.user.email,
    phone: grade.user.phone,
    status: grade.status,
    autoScore: grade.autoScore,
    manualScore: grade.manualScore,
    finalScore: grade.finalScore,
    maxScore: grade.maxScore,
    completionRate: roundNumber(grade.completionRate),
    solvedProblemCount: grade.solvedProblemCount,
    attemptedProblemCount: grade.attemptedProblemCount,
    submissionCount: grade.submissionCount,
    feedback: grade.feedback,
    lastSubmissionAt: grade.lastSubmissionAt?.toISOString() ?? null,
    gradedAt: grade.gradedAt?.toISOString() ?? null,
    gradedBy: grade.gradedBy
      ? {
          id: grade.gradedBy.id,
          name: grade.gradedBy.name,
          email: grade.gradedBy.email,
        }
      : null,
  }))

  const gradeSummary = {
    studentCount: grades.length,
    gradedCount: grades.filter((item) => item.finalScore > 0 || item.completionRate > 0).length,
    avgScore: grades.length ? roundNumber(grades.reduce((sum, item) => sum + item.finalScore, 0) / grades.length) : 0,
    avgCompletionRate: grades.length
      ? roundNumber(grades.reduce((sum, item) => sum + item.completionRate, 0) / grades.length)
      : 0,
  }

  return {
    ...mapAssignmentItem({
      ...assignment,
      grades: assignment.grades.map((item) => ({
        finalScore: item.finalScore,
        completionRate: item.completionRate,
        manualScore: item.manualScore,
      })),
    }),
    classInfo: {
      id: assignment.group.id,
      name: assignment.group.name,
      slug: assignment.group.slug,
      organizationId: assignment.group.organizationId,
    },
    stats: {
      studentCount: gradeSummary.studentCount,
      gradedCount: gradeSummary.gradedCount,
      avgScore: gradeSummary.avgScore,
      avgCompletionRate: gradeSummary.avgCompletionRate,
      completionRate: gradeSummary.avgCompletionRate,
    },
    grades,
  }
}

export async function syncTenantAssignmentGrades(
  viewer: Viewer,
  organizationId: string,
  classId: string,
  assignmentId: string,
) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  await requireClassInOrganization(organizationId, classId)
  await requireAssignmentInClass(organizationId, classId, assignmentId)

  await db.$transaction(async (tx) => {
    await syncAssignmentGradeRows(tx, assignmentId)
  })

  return getTenantAssignmentDetail(viewer, organizationId, classId, assignmentId)
}

export async function updateTenantAssignmentGrade(
  viewer: Viewer,
  organizationId: string,
  classId: string,
  assignmentId: string,
  studentId: string,
  input: TenantUpdateAssignmentGradeInput,
) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  await requireClassInOrganization(organizationId, classId)
  await requireAssignmentInClass(organizationId, classId, assignmentId)

  const membership = await db.teachingGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: classId,
        userId: studentId,
      },
    },
    select: {
      userId: true,
      memberRole: true,
    },
  })
  if (!membership || membership.memberRole === "teacher") {
    throw new TenantAdminError("student_not_found", "班级内未找到该学生", 404)
  }

  const existing = await db.teachingGroupAssignmentGrade.findUnique({
    where: {
      assignmentId_userId: {
        assignmentId,
        userId: studentId,
      },
    },
    select: {
      id: true,
      autoScore: true,
      maxScore: true,
    },
  })
  if (!existing) {
    await db.$transaction(async (tx) => {
      await syncAssignmentGradeRows(tx, assignmentId)
    })
  }

  await db.teachingGroupAssignmentGrade.upsert({
    where: {
      assignmentId_userId: {
        assignmentId,
        userId: studentId,
      },
    },
    update: {
      manualScore: input.manualScore ?? null,
      finalScore: input.manualScore ?? existing?.autoScore ?? 0,
      feedback: input.feedback?.trim() || null,
      gradedAt: new Date(),
      gradedById: viewer.id,
      status: input.manualScore != null ? "graded" : undefined,
    },
    create: {
      assignmentId,
      userId: studentId,
      manualScore: input.manualScore ?? null,
      autoScore: 0,
      finalScore: input.manualScore ?? 0,
      maxScore: existing?.maxScore ?? 100,
      feedback: input.feedback?.trim() || null,
      gradedAt: new Date(),
      gradedById: viewer.id,
      status: input.manualScore != null ? "graded" : "pending",
    },
  })

  return getTenantAssignmentDetail(viewer, organizationId, classId, assignmentId)
}

export async function createTenantTeacher(viewer: Viewer, organizationId: string, input: TenantCreateUserInput) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin"])
  const result = await db.$transaction(async (tx) => {
    const user = await createUserIfNeeded(tx, input)
    await ensureUserRole(tx, user.id, "teacher")
    await ensureOrganizationMembership(tx, organizationId, user.id, "teacher")
    await tx.teacherProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationId,
        displayName: input.name?.trim() || undefined,
        title: input.title?.trim() || undefined,
        bio: input.bio?.trim() || undefined,
        specialties: input.specialties ?? [],
        status: "active",
      },
      create: {
        userId: user.id,
        organizationId,
        displayName: input.name?.trim() || user.name || null,
        title: input.title?.trim() || null,
        bio: input.bio?.trim() || null,
        specialties: input.specialties ?? [],
        status: "active",
      },
    })
    return user
  })
  return result
}

export async function createTenantStudent(
  viewer: Viewer,
  organizationId: string,
  input: TenantCreateUserInput & { classId?: string },
) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin", "teacher"])
  if (input.classId) {
    await requireClassInOrganization(organizationId, input.classId)
  }
  const result = await db.$transaction(async (tx) => {
    const user = await createUserIfNeeded(tx, input)
    await ensureUserRole(tx, user.id, "student")
    await ensureOrganizationMembership(tx, organizationId, user.id, "student")
    if (input.classId) {
      await tx.teachingGroupMember.upsert({
        where: {
          groupId_userId: {
            groupId: input.classId,
            userId: user.id,
          },
        },
        update: {
          memberRole: "student",
          status: "active",
        },
        create: {
          groupId: input.classId,
          userId: user.id,
          memberRole: "student",
          status: "active",
        },
      })
    }
    return user
  })
  return result
}

export async function listOrganizationApiKeys(viewer: Viewer, organizationId: string) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin"])
  const rows = await db.organizationApiKey.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })
  return rows.map(mapApiKey)
}

export async function createOrganizationApiKey(viewer: Viewer, organizationId: string, input: TenantCreateApiKeyInput) {
  await requireOrganizationAccess(viewer, organizationId, ["org_admin"])
  const rawToken = `org_${organizationId}.${randomUUID().replace(/-/g, "")}`
  const tokenHash = hashApiKeyToken(rawToken)
  const created = await db.organizationApiKey.create({
    data: {
      organizationId,
      createdById: viewer.id,
      name: input.name.trim(),
      tokenHash,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      status: "active",
    },
    select: {
      id: true,
      name: true,
      status: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  })

  return {
    apiKey: mapApiKey(created),
    rawToken,
  }
}

export async function authenticateOrganizationApiKey(rawToken: string | null) {
  if (!rawToken) {
    throw new TenantAdminError("unauthorized", "缺少 API Key", 401)
  }
  const tokenHash = hashApiKeyToken(rawToken)
  const apiKey = await db.organizationApiKey.findUnique({
    where: { tokenHash },
    include: {
      organization: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })
  if (!apiKey || apiKey.status !== "active") {
    throw new TenantAdminError("unauthorized", "API Key 无效", 401)
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new TenantAdminError("unauthorized", "API Key 已过期", 401)
  }
  if (apiKey.organization.status !== "active") {
    throw new TenantAdminError("forbidden", "租户不可用", 403)
  }

  const now = new Date()
  if (
    !apiKey.lastUsedAt ||
    now.getTime() - apiKey.lastUsedAt.getTime() >= API_KEY_LAST_USED_WRITE_INTERVAL_MS
  ) {
    await db.organizationApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: now },
    })
  }

  return {
    organizationId: apiKey.organization.id,
    createdById: apiKey.createdById,
  }
}
