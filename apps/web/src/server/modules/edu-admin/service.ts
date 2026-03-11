import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { hashPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { UserProblemStatus } from "@/lib/oj"
import type {
  OrganizationDetail,
  OrganizationInput,
  OrganizationItem,
  TeacherProfileInput,
  TeacherProfileItem,
  TeachingGroupAssignmentInput,
  TeachingGroupDetail,
  TeachingGroupMemberImportInput,
  TeachingGroupInput,
  TeachingGroupItem,
  TeachingGroupMembersInput,
  TeachingGroupStats,
} from "@/lib/edu-admin"

export class EduAdminError extends Error {
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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
}

function isEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value)
}

function isPhone(value: string) {
  return /^\+?[0-9][0-9\- ]{5,}$/.test(value)
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

type ParsedImportLine = {
  name?: string
  identifier?: string
  email?: string
  phone?: string
  memberRole: string
  status: string
}

function parseImportLine(line: string, defaultRole: string): ParsedImportLine {
  const parts = line
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    throw new EduAdminError("invalid_import_line", "导入内容存在空行", 400)
  }

  if (parts.length === 1) {
    return {
      identifier: parts[0],
      email: isEmail(parts[0]) ? parts[0].toLowerCase() : undefined,
      phone: isPhone(parts[0]) ? parts[0] : undefined,
      memberRole: defaultRole,
      status: "active",
    }
  }

  if (isEmail(parts[0]) || isPhone(parts[0])) {
    return {
      identifier: parts[0],
      email: isEmail(parts[0]) ? parts[0].toLowerCase() : undefined,
      phone: isPhone(parts[0]) ? parts[0] : undefined,
      memberRole: parts[1] || defaultRole,
      status: parts[2] || "active",
    }
  }

  const name = parts[0]
  const second = parts[1]
  const third = parts[2]
  const fourth = parts[3]
  const fifth = parts[4]

  const email = second && isEmail(second) ? second.toLowerCase() : undefined
  const phone =
    (second && isPhone(second) ? second : undefined) ||
    (third && isPhone(third) ? third : undefined)

  const identifier = email || phone || second
  const memberRole = phone && fourth ? fourth : third && !isPhone(third) ? third : defaultRole
  const status = phone && fifth ? fifth : fourth && !phone ? fourth : "active"

  return {
    name,
    identifier,
    email,
    phone,
    memberRole,
    status,
  }
}

async function resolveUserByIdentifier(identifier: string) {
  const value = identifier.trim()
  if (!value) {
    throw new EduAdminError("invalid_user_identifier", "用户标识不能为空", 400)
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { id: value },
        { email: value.toLowerCase() },
        { phone: value },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
    },
  })

  if (!user) {
    throw new EduAdminError("user_not_found", "未找到对应用户", 404)
  }

  return user
}

async function ensureOrganizationMembership(
  client: Prisma.TransactionClient | typeof db,
  organizationId: string,
  userId: string,
  role: string,
) {
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

function mapOrganization(item: {
  id: string
  slug: string
  name: string
  shortName: string | null
  type: string
  status: string
  description: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  createdAt: Date
  updatedAt: Date
  _count: {
    members: number
    teacherProfiles: number
    teachingGroups: number
  }
}): OrganizationItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName,
    type: item.type,
    status: item.status,
    description: item.description,
    contactName: item.contactName,
    contactEmail: item.contactEmail,
    contactPhone: item.contactPhone,
    memberCount: item._count.members,
    teacherCount: item._count.teacherProfiles,
    groupCount: item._count.teachingGroups,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function mapTeacherProfile(item: {
  userId: string
  displayName: string | null
  title: string | null
  bio: string | null
  specialties: unknown
  status: string
  createdAt: Date
  updatedAt: Date
  organization: {
    id: string
    name: string
  } | null
  user: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    status: string
  }
}): TeacherProfileItem {
  return {
    userId: item.userId,
    displayName: item.displayName,
    title: item.title,
    bio: item.bio,
    specialties: normalizeStringArray(item.specialties),
    status: item.status,
    organization: item.organization,
    user: item.user,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function mapTeachingGroup(item: {
  id: string
  slug: string
  name: string
  code: string | null
  groupType: string
  status: string
  summary: string | null
  createdAt: Date
  updatedAt: Date
  startAt: Date | null
  endAt: Date | null
  organization: {
    id: string
    name: string
  } | null
  owner: {
    id: string
    name: string | null
    email: string | null
  }
  _count: {
    members: number
  }
}): TeachingGroupItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    code: item.code,
    groupType: item.groupType,
    status: item.status,
    summary: item.summary,
    organization: item.organization,
    owner: item.owner,
    memberCount: item._count.members,
    startAt: item.startAt?.toISOString() ?? null,
    endAt: item.endAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function mapTeachingGroupAssignment(item: {
  id: string
  status: string
  title: string | null
  note: string | null
  dueAt: Date | null
  createdAt: Date
  problemSet: {
    id: string
    title: string
    visibility: string
    items: Array<{ problemId: string }>
  }
  assignedBy: {
    id: string
    name: string | null
    email: string | null
  }
}) {
  return {
    id: item.id,
    status: item.status,
    title: item.title,
    note: item.note,
    dueAt: item.dueAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    problemSet: {
      id: item.problemSet.id,
      title: item.problemSet.title,
      visibility: item.problemSet.visibility,
      itemCount: item.problemSet.items.length,
    },
    assignedBy: item.assignedBy,
  }
}

export async function listOrganizations() {
  const items = await db.organization.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          members: true,
          teacherProfiles: true,
          teachingGroups: true,
        },
      },
    },
  })

  return items.map(mapOrganization)
}

export async function getOrganizationDetail(id: string): Promise<OrganizationDetail> {
  const item = await db.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          members: true,
          teacherProfiles: true,
          teachingGroups: true,
        },
      },
      teacherProfiles: {
        orderBy: [{ updatedAt: "desc" }],
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      },
      teachingGroups: {
        orderBy: [{ updatedAt: "desc" }],
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
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
      },
    },
  })

  if (!item) {
    throw new EduAdminError("organization_not_found", "机构不存在", 404)
  }

  return {
    ...mapOrganization(item),
    teachers: item.teacherProfiles.map(mapTeacherProfile),
    groups: item.teachingGroups.map(mapTeachingGroup),
  }
}

export async function createOrganization(input: OrganizationInput) {
  const slug = input.slug?.trim() || slugify(input.name)
  if (!slug) {
    throw new EduAdminError("invalid_slug", "机构 slug 不能为空", 400)
  }

  const created = await db.organization.create({
    data: {
      slug,
      name: input.name.trim(),
      shortName: input.shortName?.trim() || null,
      type: input.type?.trim() || "institution",
      status: input.status?.trim() || "draft",
      description: input.description?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
    },
    include: {
      _count: {
        select: {
          members: true,
          teacherProfiles: true,
          teachingGroups: true,
        },
      },
    },
  })

  return mapOrganization(created)
}

export async function updateOrganization(id: string, input: Partial<OrganizationInput>) {
  const organization = await db.organization.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!organization) {
    throw new EduAdminError("organization_not_found", "机构不存在", 404)
  }

  const updated = await db.organization.update({
    where: { id },
    data: {
      slug: input.slug?.trim() || undefined,
      name: input.name?.trim() || undefined,
      shortName: input.shortName === undefined ? undefined : input.shortName.trim() || null,
      type: input.type?.trim() || undefined,
      status: input.status?.trim() || undefined,
      description: input.description === undefined ? undefined : input.description.trim() || null,
      contactName: input.contactName === undefined ? undefined : input.contactName.trim() || null,
      contactEmail: input.contactEmail === undefined ? undefined : input.contactEmail.trim() || null,
      contactPhone: input.contactPhone === undefined ? undefined : input.contactPhone.trim() || null,
    },
    include: {
      _count: {
        select: {
          members: true,
          teacherProfiles: true,
          teachingGroups: true,
        },
      },
    },
  })

  return mapOrganization(updated)
}

export async function listTeacherProfiles() {
  const items = await db.teacherProfile.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      },
    },
  })

  return items.map(mapTeacherProfile)
}

export async function upsertTeacherProfile(input: TeacherProfileInput) {
  const user = await resolveUserByIdentifier(input.userIdentifier)

  const profile = await db.teacherProfile.upsert({
    where: { userId: user.id },
    update: {
      organizationId: input.organizationId?.trim() || null,
      displayName: input.displayName?.trim() || null,
      title: input.title?.trim() || null,
      bio: input.bio?.trim() || null,
      specialties: input.specialties ?? [],
      status: input.status?.trim() || "draft",
    },
    create: {
      userId: user.id,
      organizationId: input.organizationId?.trim() || null,
      displayName: input.displayName?.trim() || user.name || null,
      title: input.title?.trim() || null,
      bio: input.bio?.trim() || null,
      specialties: input.specialties ?? [],
      status: input.status?.trim() || "draft",
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      },
    },
  })

  if (profile.organizationId) {
    await ensureOrganizationMembership(db, profile.organizationId, user.id, "teacher")
  }

  return mapTeacherProfile(profile)
}

export async function listTeachingGroups() {
  const items = await db.teachingGroup.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
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

  return items.map(mapTeachingGroup)
}

export async function createTeachingGroup(input: TeachingGroupInput) {
  const owner = await resolveUserByIdentifier(input.ownerIdentifier)
  const slug = input.slug?.trim() || slugify(input.name)
  if (!slug) {
    throw new EduAdminError("invalid_slug", "教学组 slug 不能为空", 400)
  }

  const created = await db.teachingGroup.create({
    data: {
      organizationId: input.organizationId?.trim() || null,
      ownerId: owner.id,
      slug,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      groupType: input.groupType?.trim() || "class",
      status: input.status?.trim() || "draft",
      summary: input.summary?.trim() || null,
      startAt: input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
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

  if (created.organizationId) {
    await ensureOrganizationMembership(db, created.organizationId, owner.id, "teacher")
  }

  return mapTeachingGroup(created)
}

export async function updateTeachingGroup(id: string, input: Partial<TeachingGroupInput>) {
  const existing = await db.teachingGroup.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    throw new EduAdminError("teaching_group_not_found", "教学组不存在", 404)
  }

  const owner = input.ownerIdentifier ? await resolveUserByIdentifier(input.ownerIdentifier) : null

  const updated = await db.teachingGroup.update({
    where: { id },
    data: {
      organizationId: input.organizationId === undefined ? undefined : input.organizationId.trim() || null,
      ownerId: owner?.id || undefined,
      slug: input.slug?.trim() || undefined,
      name: input.name?.trim() || undefined,
      code: input.code === undefined ? undefined : input.code.trim() || null,
      groupType: input.groupType?.trim() || undefined,
      status: input.status?.trim() || undefined,
      summary: input.summary === undefined ? undefined : input.summary.trim() || null,
      startAt: input.startAt === undefined ? undefined : input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt === undefined ? undefined : input.endAt ? new Date(input.endAt) : null,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
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

  if (updated.organizationId) {
    await ensureOrganizationMembership(db, updated.organizationId, updated.owner.id, "teacher")
  }

  return mapTeachingGroup(updated)
}

export async function getTeachingGroupDetail(id: string): Promise<TeachingGroupDetail> {
  const item = await db.teachingGroup.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
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
              status: true,
            },
          },
        },
      },
      campClasses: {
        orderBy: [{ startAt: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          startAt: true,
          endAt: true,
        },
      },
      assignments: {
        where: { status: { not: "archived" } },
        orderBy: [{ createdAt: "desc" }],
        include: {
          problemSet: {
            select: {
              id: true,
              title: true,
              visibility: true,
              items: {
                select: {
                  problemId: true,
                },
              },
            },
          },
          assignedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
  })

  if (!item) {
    throw new EduAdminError("teaching_group_not_found", "教学组不存在", 404)
  }

  return {
    ...mapTeachingGroup(item),
    members: item.members.map((member) => ({
      userId: member.userId,
      memberRole: member.memberRole,
      status: member.status,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    })),
    campClasses: item.campClasses.map((campClass) => ({
      id: campClass.id,
      slug: campClass.slug,
      title: campClass.title,
      status: campClass.status,
      startAt: campClass.startAt.toISOString(),
      endAt: campClass.endAt.toISOString(),
    })),
    assignments: item.assignments.map(mapTeachingGroupAssignment),
  }
}

export async function replaceTeachingGroupMembers(id: string, input: TeachingGroupMembersInput) {
  const group = await db.teachingGroup.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  })
  if (!group) {
    throw new EduAdminError("teaching_group_not_found", "教学组不存在", 404)
  }

  const resolvedMembers = await Promise.all(
    input.members.map(async (item) => {
      const user = await resolveUserByIdentifier(item.userIdentifier)
      return {
        userId: user.id,
        memberRole: item.memberRole?.trim() || "student",
        status: item.status?.trim() || "active",
      }
    }),
  )

  await db.$transaction(async (tx) => {
    await tx.teachingGroupMember.deleteMany({
      where: { groupId: id },
    })

    if (resolvedMembers.length > 0) {
      await tx.teachingGroupMember.createMany({
        data: resolvedMembers.map((item) => ({
          groupId: id,
          userId: item.userId,
          memberRole: item.memberRole,
          status: item.status,
        })),
      })
    }

    if (group.organizationId) {
      for (const item of resolvedMembers) {
        await ensureOrganizationMembership(
          tx,
          group.organizationId,
          item.userId,
          item.memberRole === "teacher" ? "teacher" : "student",
        )
      }
    }
  })
}

async function resolveOrCreateImportedUser(
  client: Prisma.TransactionClient,
  parsed: ParsedImportLine,
) {
  const identifier = parsed.identifier?.trim()
  const email = parsed.email?.trim().toLowerCase()
  const phone = parsed.phone?.trim()

  const existing = await client.user.findFirst({
    where: {
      OR: [
        ...(identifier ? [{ id: identifier }, { email: identifier.toLowerCase() }, { phone: identifier }] : []),
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      status: true,
    },
  })

  if (existing) {
    await ensureUserRole(client, existing.id, parsed.memberRole === "teacher" ? "teacher" : "student")
    return { user: existing, created: false }
  }

  if (!email && !phone) {
    throw new EduAdminError("user_not_found", `未找到用户：${identifier || parsed.name || "unknown"}`, 404)
  }

  const password = await hashPassword(`Temp#${randomUUID().slice(0, 10)}`)
  const created = await client.user.create({
    data: {
      name: parsed.name || email || phone || "新学员",
      email,
      phone,
      emailVerifiedAt: email ? new Date() : undefined,
      phoneVerifiedAt: phone ? new Date() : undefined,
      password,
      status: "active",
    },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      status: true,
    },
  })

  await ensureUserRole(client, created.id, parsed.memberRole === "teacher" ? "teacher" : "student")
  return { user: created, created: true }
}

export async function importTeachingGroupMembers(id: string, input: TeachingGroupMemberImportInput) {
  const group = await db.teachingGroup.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  })
  if (!group) {
    throw new EduAdminError("teaching_group_not_found", "班级不存在", 404)
  }

  const lines = input.lines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new EduAdminError("empty_import", "导入内容不能为空", 400)
  }

  const parsed = lines.map((line) => parseImportLine(line, input.defaultRole?.trim() || "student"))
  let createdUserCount = 0

  const result = await db.$transaction(async (tx) => {
    let importedCount = 0

    for (const item of parsed) {
      const { user, created } = await resolveOrCreateImportedUser(tx, item)
      if (created) createdUserCount += 1

      await tx.teachingGroupMember.upsert({
        where: {
          groupId_userId: {
            groupId: id,
            userId: user.id,
          },
        },
        update: {
          memberRole: item.memberRole,
          status: item.status,
        },
        create: {
          groupId: id,
          userId: user.id,
          memberRole: item.memberRole,
          status: item.status,
        },
      })

      if (group.organizationId) {
        await ensureOrganizationMembership(
          tx,
          group.organizationId,
          user.id,
          item.memberRole === "teacher" ? "teacher" : "student",
        )
      }

      importedCount += 1
    }

    return { importedCount }
  })

  return {
    ...result,
    createdUserCount,
  }
}

export async function createTeachingGroupAssignment(
  groupId: string,
  input: TeachingGroupAssignmentInput,
  assignedById: string,
) {
  const group = await db.teachingGroup.findUnique({
    where: { id: groupId },
    select: { id: true },
  })
  if (!group) {
    throw new EduAdminError("teaching_group_not_found", "班级不存在", 404)
  }

  const problemSet = await db.problemSet.findUnique({
    where: { id: input.problemSetId },
    select: { id: true },
  })
  if (!problemSet) {
    throw new EduAdminError("problem_set_not_found", "题单不存在", 404)
  }

  const created = await db.teachingGroupProblemSetAssignment.upsert({
    where: {
      groupId_problemSetId: {
        groupId,
        problemSetId: input.problemSetId,
      },
    },
    update: {
      title: input.title?.trim() || null,
      note: input.note?.trim() || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: input.status?.trim() || "active",
      assignedById,
    },
    create: {
      groupId,
      problemSetId: input.problemSetId,
      assignedById,
      title: input.title?.trim() || null,
      note: input.note?.trim() || null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: input.status?.trim() || "active",
    },
    include: {
      problemSet: {
        select: {
          id: true,
          title: true,
          visibility: true,
          items: {
            select: {
              problemId: true,
            },
          },
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return mapTeachingGroupAssignment(created)
}

export async function getTeachingGroupStats(id: string): Promise<TeachingGroupStats> {
  const group = await db.teachingGroup.findUnique({
    where: { id },
    include: {
      members: {
        where: { status: "active" },
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
        where: { status: "active" },
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
        },
      },
    },
  })

  if (!group) {
    throw new EduAdminError("teaching_group_not_found", "班级不存在", 404)
  }

  const studentMembers = group.members.filter((member) => member.memberRole !== "teacher")
  const teacherMembers = group.members.filter((member) => member.memberRole === "teacher")
  const userIds = studentMembers.map((member) => member.userId)
  const assignmentProblemMap = new Map<string, string[]>()

  for (const assignment of group.assignments) {
    assignmentProblemMap.set(
      assignment.id,
      assignment.problemSet.items.map((item) => item.problemId),
    )
  }

  const allProblemIds = [...new Set([...assignmentProblemMap.values()].flat())]

  if (userIds.length === 0 || allProblemIds.length === 0) {
    return {
      summary: {
        studentCount: studentMembers.length,
        teacherCount: teacherMembers.length,
        assignmentCount: group.assignments.length,
        assignedProblemCount: allProblemIds.length,
        activeStudentCount: 0,
        totalSubmissions: 0,
        solvedStudentProblemCount: 0,
        avgCompletionRate: 0,
        lastActivityAt: null,
      },
      assignments: group.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        title: assignment.title || assignment.problemSet.title,
        problemCount: assignment.problemSet.items.length,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        startedStudentCount: 0,
        completedStudentCount: 0,
        avgCompletionRate: 0,
      })),
      members: studentMembers.map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        phone: member.user.phone,
        memberRole: member.memberRole,
        status: member.status,
        attemptedProblemCount: 0,
        solvedProblemCount: 0,
        submissionCount: 0,
        completionRate: 0,
        lastActiveAt: null,
      })),
    }
  }

  const [progressRows, submissionRows] = await Promise.all([
    db.userProblemProgress.findMany({
      where: {
        userId: { in: userIds },
        problemId: { in: allProblemIds },
      },
      select: {
        userId: true,
        problemId: true,
        status: true,
        solvedAt: true,
        updatedAt: true,
      },
    }),
    db.submission.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        problemId: { in: allProblemIds },
      },
      _count: {
        _all: true,
      },
      _max: {
        createdAt: true,
      },
    }),
  ])

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
        count: row._count._all,
        lastActiveAt: row._max.createdAt?.toISOString() ?? null,
      },
    ]),
  )

  const members = studentMembers.map((member) => {
    const rows = progressByUser.get(member.userId) ?? []
    const attemptedProblemCount = rows.length
    const solvedProblemCount = rows.filter((row) => row.status >= UserProblemStatus.ACCEPTED).length
    const completionRate = allProblemIds.length
      ? Number(((solvedProblemCount / allProblemIds.length) * 100).toFixed(1))
      : 0
    const submissionSummary = submissionByUser.get(member.userId)
    const lastProgressAt = rows.reduce<string | null>((latest, row) => {
      const iso = row.updatedAt.toISOString()
      if (!latest || iso > latest) return iso
      return latest
    }, null)

    return {
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      phone: member.user.phone,
      memberRole: member.memberRole,
      status: member.status,
      attemptedProblemCount,
      solvedProblemCount,
      submissionCount: submissionSummary?.count ?? 0,
      completionRate,
      lastActiveAt: submissionSummary?.lastActiveAt ?? lastProgressAt ?? null,
    }
  })

  const assignments = group.assignments.map((assignment) => {
    const problemIds = assignmentProblemMap.get(assignment.id) ?? []
    const startedStudentCount = members.filter((member) => {
      const rows = progressByUser.get(member.userId) ?? []
      return rows.some((row) => problemIds.includes(row.problemId))
    }).length

    const completedStudentCount = members.filter((member) => {
      const rows = progressByUser.get(member.userId) ?? []
      if (problemIds.length === 0) return false
      const solved = new Set(
        rows
          .filter((row) => row.status >= UserProblemStatus.ACCEPTED && problemIds.includes(row.problemId))
          .map((row) => row.problemId),
      )
      return solved.size >= problemIds.length
    }).length

    const avgCompletionRate = members.length
      ? Number(
          (
            members.reduce((acc, member) => {
              const rows = progressByUser.get(member.userId) ?? []
              const solved = new Set(
                rows
                  .filter((row) => row.status >= UserProblemStatus.ACCEPTED && problemIds.includes(row.problemId))
                  .map((row) => row.problemId),
              )
              return acc + (problemIds.length ? solved.size / problemIds.length : 0)
            }, 0) /
            members.length *
            100
          ).toFixed(1),
        )
      : 0

    return {
      assignmentId: assignment.id,
      title: assignment.title || assignment.problemSet.title,
      problemCount: problemIds.length,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      startedStudentCount,
      completedStudentCount,
      avgCompletionRate,
    }
  })

  const totalSolvedStudentProblemCount = members.reduce((acc, item) => acc + item.solvedProblemCount, 0)
  const totalSubmissions = members.reduce((acc, item) => acc + item.submissionCount, 0)
  const avgCompletionRate = members.length
    ? Number((members.reduce((acc, item) => acc + item.completionRate, 0) / members.length).toFixed(1))
    : 0
  const lastActivityAt =
    members
      .map((item) => item.lastActiveAt)
      .filter((item): item is string => Boolean(item))
      .sort()
      .at(-1) ?? null

  return {
    summary: {
      studentCount: studentMembers.length,
      teacherCount: teacherMembers.length,
      assignmentCount: group.assignments.length,
      assignedProblemCount: allProblemIds.length,
      activeStudentCount: members.filter((item) => item.attemptedProblemCount > 0 || item.submissionCount > 0).length,
      totalSubmissions,
      solvedStudentProblemCount: totalSolvedStudentProblemCount,
      avgCompletionRate,
      lastActivityAt,
    },
    assignments,
    members: members.sort((a, b) => {
      if (b.solvedProblemCount !== a.solvedProblemCount) return b.solvedProblemCount - a.solvedProblemCount
      if (b.submissionCount !== a.submissionCount) return b.submissionCount - a.submissionCount
      return (a.name || a.email || a.userId).localeCompare(b.name || b.email || b.userId, "zh-CN")
    }),
  }
}
