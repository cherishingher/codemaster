import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import type { AuthUser } from "@/lib/authz"
import {
  authenticateOrganizationApiKey,
  createTenantClassAssignment,
  createOrganizationApiKey,
  createTenantClass,
  createTenantOrganization,
  createTenantStudent,
  createTenantTeacher,
  getTenantAssignmentDetail,
  getTenantClass,
  getTenantClassStats,
  getTenantOrganization,
  listOrganizationApiKeys,
  listTenantClassAssignments,
  listTenantClasses,
  listViewerOrganizations,
  TenantAdminError,
  syncTenantAssignmentGrades,
  updateTenantAssignmentGrade,
} from "@/server/modules/tenant-admin/service"

const CreateTenantOrganizationSchema = z.object({
  slug: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().max(60).optional(),
  externalCode: z.string().trim().max(80).optional(),
  type: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  description: z.string().trim().max(2000).optional(),
  contactName: z.string().trim().max(60).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().max(40).optional(),
  adminIdentifier: z.string().trim().min(1).max(120),
  adminName: z.string().trim().max(80).optional(),
})

const CreateUserSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional(),
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(1000).optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).optional(),
  classId: z.string().trim().max(64).optional(),
})

const CreateClassSchema = z.object({
  slug: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(60).optional(),
  externalCode: z.string().trim().max(80).optional(),
  summary: z.string().trim().max(1000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
})

const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  expiresAt: z.string().datetime().optional(),
})

const CreateAssignmentSchema = z.object({
  problemSetId: z.string().trim().min(1).max(64),
  title: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  gradingMode: z.string().trim().max(40).optional(),
  publishNow: z.boolean().optional(),
})

const UpdateAssignmentGradeSchema = z.object({
  manualScore: z.number().int().min(0).max(1000).nullable().optional(),
  feedback: z.string().trim().max(2000).optional(),
})

function mapError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "invalid_payload", message: "请求参数不合法", issues: error.flatten() },
      { status: 400 },
    )
  }
  if (error instanceof TenantAdminError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  }
  console.error("[tenant-admin]", error)
  return NextResponse.json({ error: "internal_error", message: "租户服务暂时不可用" }, { status: 500 })
}

function toViewer(user: AuthUser) {
  return {
    id: user.id,
    roles: user.roles,
  }
}

export async function handleCreateTenantOrganization(req: NextRequest, user: AuthUser) {
  try {
    const input = CreateTenantOrganizationSchema.parse(await req.json())
    return NextResponse.json({ data: await createTenantOrganization(toViewer(user), input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListViewerOrganizations(user: AuthUser) {
  try {
    return NextResponse.json({ data: await listViewerOrganizations(toViewer(user)) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetTenantOrganization(user: AuthUser, organizationId: string) {
  try {
    return NextResponse.json({ data: await getTenantOrganization(toViewer(user), organizationId) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListTenantClasses(user: AuthUser, organizationId: string) {
  try {
    return NextResponse.json({ data: await listTenantClasses(toViewer(user), organizationId) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateTenantClass(req: NextRequest, user: AuthUser, organizationId: string) {
  try {
    const input = CreateClassSchema.parse(await req.json())
    return NextResponse.json({ data: await createTenantClass(toViewer(user), organizationId, input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateTenantTeacher(req: NextRequest, user: AuthUser, organizationId: string) {
  try {
    const input = CreateUserSchema.parse(await req.json())
    return NextResponse.json({ data: await createTenantTeacher(toViewer(user), organizationId, input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateTenantStudent(req: NextRequest, user: AuthUser, organizationId: string) {
  try {
    const input = CreateUserSchema.parse(await req.json())
    return NextResponse.json({ data: await createTenantStudent(toViewer(user), organizationId, input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetTenantClass(user: AuthUser, organizationId: string, classId: string) {
  try {
    return NextResponse.json({ data: await getTenantClass(toViewer(user), organizationId, classId) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetTenantClassStats(user: AuthUser, organizationId: string, classId: string) {
  try {
    return NextResponse.json({ data: await getTenantClassStats(toViewer(user), organizationId, classId) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListTenantClassAssignments(user: AuthUser, organizationId: string, classId: string) {
  try {
    return NextResponse.json({ data: await listTenantClassAssignments(toViewer(user), organizationId, classId) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateTenantClassAssignment(req: NextRequest, user: AuthUser, organizationId: string, classId: string) {
  try {
    const input = CreateAssignmentSchema.parse(await req.json())
    return NextResponse.json(
      { data: await createTenantClassAssignment(toViewer(user), organizationId, classId, input) },
      { status: 201 },
    )
  } catch (error) {
    return mapError(error)
  }
}

export async function handleGetTenantAssignmentDetail(
  user: AuthUser,
  organizationId: string,
  classId: string,
  assignmentId: string,
) {
  try {
    return NextResponse.json({
      data: await getTenantAssignmentDetail(toViewer(user), organizationId, classId, assignmentId),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleSyncTenantAssignmentGrades(
  user: AuthUser,
  organizationId: string,
  classId: string,
  assignmentId: string,
) {
  try {
    return NextResponse.json({
      data: await syncTenantAssignmentGrades(toViewer(user), organizationId, classId, assignmentId),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleUpdateTenantAssignmentGrade(
  req: NextRequest,
  user: AuthUser,
  organizationId: string,
  classId: string,
  assignmentId: string,
  studentId: string,
) {
  try {
    const input = UpdateAssignmentGradeSchema.parse(await req.json())
    return NextResponse.json({
      data: await updateTenantAssignmentGrade(toViewer(user), organizationId, classId, assignmentId, studentId, input),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleListOrganizationApiKeys(user: AuthUser, organizationId: string) {
  try {
    return NextResponse.json({ data: await listOrganizationApiKeys(toViewer(user), organizationId) })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleCreateOrganizationApiKey(req: NextRequest, user: AuthUser, organizationId: string) {
  try {
    const input = CreateApiKeySchema.parse(await req.json())
    return NextResponse.json({ data: await createOrganizationApiKey(toViewer(user), organizationId, input) }, { status: 201 })
  } catch (error) {
    return mapError(error)
  }
}

async function resolveOpenOrganizationId(req: NextRequest) {
  const rawToken = req.headers.get("x-org-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  return authenticateOrganizationApiKey(rawToken)
}

export async function handleOpenCreateTenantClass(req: NextRequest) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    const input = CreateClassSchema.parse(await req.json())
    return NextResponse.json(
      {
        data: await createTenantClass(
          { id: auth.createdById, roles: ["admin"] },
          auth.organizationId,
          input,
        ),
      },
      { status: 201 },
    )
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenCreateTenantTeacher(req: NextRequest) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    const input = CreateUserSchema.parse(await req.json())
    return NextResponse.json(
      {
        data: await createTenantTeacher(
          { id: auth.createdById, roles: ["admin"] },
          auth.organizationId,
          input,
        ),
      },
      { status: 201 },
    )
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenCreateTenantStudent(req: NextRequest) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    const input = CreateUserSchema.parse(await req.json())
    return NextResponse.json(
      {
        data: await createTenantStudent(
          { id: auth.createdById, roles: ["admin"] },
          auth.organizationId,
          input,
        ),
      },
      { status: 201 },
    )
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenGetTenantClassStats(req: NextRequest, classId: string) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    return NextResponse.json({
      data: await getTenantClassStats({ id: auth.createdById, roles: ["admin"] }, auth.organizationId, classId),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenListTenantClassAssignments(req: NextRequest, classId: string) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    return NextResponse.json({
      data: await listTenantClassAssignments({ id: auth.createdById, roles: ["admin"] }, auth.organizationId, classId),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenCreateTenantClassAssignment(req: NextRequest, classId: string) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    const input = CreateAssignmentSchema.parse(await req.json())
    return NextResponse.json(
      {
        data: await createTenantClassAssignment(
          { id: auth.createdById, roles: ["admin"] },
          auth.organizationId,
          classId,
          input,
        ),
      },
      { status: 201 },
    )
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenGetTenantAssignmentGrades(req: NextRequest, assignmentId: string) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    const classId = req.nextUrl.searchParams.get("classId")
    if (!classId) {
      return NextResponse.json({ error: "invalid_payload", message: "缺少 classId" }, { status: 400 })
    }
    return NextResponse.json({
      data: await getTenantAssignmentDetail(
        { id: auth.createdById, roles: ["admin"] },
        auth.organizationId,
        classId,
        assignmentId,
      ),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function handleOpenUpdateTenantAssignmentGrade(req: NextRequest, assignmentId: string, studentId: string) {
  try {
    const auth = await resolveOpenOrganizationId(req)
    const classId = req.nextUrl.searchParams.get("classId")
    if (!classId) {
      return NextResponse.json({ error: "invalid_payload", message: "缺少 classId" }, { status: 400 })
    }
    const input = UpdateAssignmentGradeSchema.parse(await req.json())
    return NextResponse.json({
      data: await updateTenantAssignmentGrade(
        { id: auth.createdById, roles: ["admin"] },
        auth.organizationId,
        classId,
        assignmentId,
        studentId,
        input,
      ),
    })
  } catch (error) {
    return mapError(error)
  }
}
