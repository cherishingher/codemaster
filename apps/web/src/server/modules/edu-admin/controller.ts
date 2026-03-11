import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import {
  createOrganization,
  createTeachingGroupAssignment,
  createTeachingGroup,
  EduAdminError,
  getOrganizationDetail,
  getTeachingGroupStats,
  getTeachingGroupDetail,
  importTeachingGroupMembers,
  listOrganizations,
  listTeacherProfiles,
  listTeachingGroups,
  replaceTeachingGroupMembers,
  updateOrganization,
  updateTeachingGroup,
  upsertTeacherProfile,
} from "@/server/modules/edu-admin/service"

const OrganizationSchema = z.object({
  slug: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().max(60).optional(),
  type: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  description: z.string().trim().max(2000).optional(),
  contactName: z.string().trim().max(60).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().max(40).optional(),
})

const TeacherProfileSchema = z.object({
  userIdentifier: z.string().trim().min(1).max(120),
  organizationId: z.string().trim().max(64).optional(),
  displayName: z.string().trim().max(80).optional(),
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).optional(),
  status: z.string().trim().max(40).optional(),
})

const TeachingGroupSchema = z.object({
  organizationId: z.string().trim().max(64).optional(),
  ownerIdentifier: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(60).optional(),
  groupType: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  summary: z.string().trim().max(2000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
})

const TeachingGroupPatchSchema = TeachingGroupSchema.partial().extend({
  ownerIdentifier: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120).optional(),
})

const TeachingGroupMembersSchema = z.object({
  members: z.array(
    z.object({
      userIdentifier: z.string().trim().min(1).max(120),
      memberRole: z.string().trim().max(40).optional(),
      status: z.string().trim().max(40).optional(),
    }),
  ),
})

const TeachingGroupImportSchema = z.object({
  lines: z.string().min(1),
  defaultRole: z.string().trim().max(40).optional(),
})

const TeachingGroupAssignmentSchema = z.object({
  problemSetId: z.string().trim().min(1).max(64),
  title: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime().optional(),
  status: z.string().trim().max(40).optional(),
})

function mapError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        message: "请求参数不合法",
        issues: error.flatten(),
      },
      { status: 400 },
    )
  }

  if (error instanceof EduAdminError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  }

  console.error("[edu-admin]", error)
  return NextResponse.json({ error: "internal_error", message: "教师 / 机构后台暂时不可用" }, { status: 500 })
}

export async function handleListOrganizations() {
  try {
    return NextResponse.json({ data: await listOrganizations() })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateOrganization(req: NextRequest) {
  try {
    const input = OrganizationSchema.parse(await req.json())
    return NextResponse.json({ data: await createOrganization(input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetOrganizationDetail(id: string) {
  try {
    return NextResponse.json({ data: await getOrganizationDetail(id) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateOrganization(req: NextRequest, id: string) {
  try {
    const input = OrganizationSchema.partial().parse(await req.json())
    return NextResponse.json({ data: await updateOrganization(id, input) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListTeacherProfiles() {
  try {
    return NextResponse.json({ data: await listTeacherProfiles() })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpsertTeacherProfile(req: NextRequest) {
  try {
    const input = TeacherProfileSchema.parse(await req.json())
    return NextResponse.json({ data: await upsertTeacherProfile(input) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListTeachingGroups() {
  try {
    return NextResponse.json({ data: await listTeachingGroups() })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateTeachingGroup(req: NextRequest) {
  try {
    const input = TeachingGroupSchema.parse(await req.json())
    return NextResponse.json({ data: await createTeachingGroup(input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetTeachingGroupDetail(id: string) {
  try {
    return NextResponse.json({ data: await getTeachingGroupDetail(id) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateTeachingGroup(req: NextRequest, id: string) {
  try {
    const input = TeachingGroupPatchSchema.parse(await req.json())
    return NextResponse.json({ data: await updateTeachingGroup(id, input) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleReplaceTeachingGroupMembers(req: NextRequest, id: string) {
  try {
    const input = TeachingGroupMembersSchema.parse(await req.json())
    await replaceTeachingGroupMembers(id, input)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleImportTeachingGroupMembers(req: NextRequest, id: string) {
  try {
    const input = TeachingGroupImportSchema.parse(await req.json())
    return NextResponse.json({ data: await importTeachingGroupMembers(id, input) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateTeachingGroupAssignment(req: NextRequest, id: string, adminId: string) {
  try {
    const input = TeachingGroupAssignmentSchema.parse(await req.json())
    return NextResponse.json({ data: await createTeachingGroupAssignment(id, input, adminId) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetTeachingGroupStats(id: string) {
  try {
    return NextResponse.json({ data: await getTeachingGroupStats(id) })
  } catch (error) {
    return mapError(error)
  }
}
