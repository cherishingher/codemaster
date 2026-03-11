import { db } from "@/lib/db"
import type {
  CampClassDetailItem,
  CampDetailItem,
  CampListItem,
  CampRankingResponse,
  CampTasksResponse,
  CampGraduationReportResponse,
} from "@/lib/camps"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"
import {
  getCampClassEnrollmentStatus,
  getCampEnrollmentStatus,
  loadOccupiedSeatCountMap,
} from "@/server/modules/camp-center/enrollment.service"
import { getCampTaskPreview, listCampTasks } from "@/server/modules/camp-center/task.service"
import { getCampGraduationReport, getCampRanking } from "@/server/modules/camp-center/rank.service"
import {
  campArgs,
  campClassArgs,
  CampCenterError,
  type CampClassRecord,
  type CampRecord,
  mapCampClass,
  normalizeHighlights,
  pickDefaultOffer,
} from "@/server/modules/camp-center/shared"

type CampViewer = {
  id?: string | null
  roles?: string[]
}

type CampListQuery = {
  q?: string | null
}

function buildCampWhere(query?: CampListQuery) {
  const q = query?.q?.trim()

  return {
    status: "published",
    visibility: {
      not: "hidden",
    },
    ...(q
      ? {
          OR: [
            {
              title: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              summary: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  }
}

function mapCampRecordToItem(
  record: CampRecord,
  occupiedSeatMap: Map<string, number>,
  enrollment: Awaited<ReturnType<typeof getCampEnrollmentStatus>>,
): CampListItem {
  const classes = record.classes.map((campClass) => mapCampClass(campClass, occupiedSeatMap.get(campClass.id) ?? 0))
  const offers = classes.flatMap((item) => item.offers)
  const defaultOffer = pickDefaultOffer(
    [...offers].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      if (a.priceCents !== b.priceCents) return a.priceCents - b.priceCents
      return a.sortOrder - b.sortOrder
    }),
  )
  const priceFrom =
    offers.length > 0
      ? offers.reduce(
          (min, item) =>
            !min || item.priceCents < min.priceCents
              ? { priceCents: item.priceCents, currency: item.currency }
              : min,
          null as { priceCents: number; currency: string } | null,
        )
      : null
  const nextStartAt =
    [...classes]
      .map((item) => item.startAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    coverImage: record.coverImage,
    suitableFor: record.suitableFor,
    difficulty: record.difficulty,
    status: record.status,
    visibility: record.visibility,
    accessLevel: record.accessLevel,
    classCount: classes.length,
    activeClassCount: classes.filter((item) => item.status === "enrolling" || item.status === "active").length,
    nextStartAt,
    priceFrom,
    defaultOffer,
    highlights: normalizeHighlights(record.highlights),
    classes,
    myEnrollment: enrollment,
  }
}

async function loadCampRecord(idOrSlug: string) {
  return db.camp.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      visibility: {
        not: "hidden",
      },
    },
    ...campArgs,
  })
}

async function loadCampClassRecord(idOrSlug: string) {
  return db.campClass.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      camp: true,
      skus: campClassArgs.include.skus,
    },
  })
}

export async function listCamps(
  query: CampListQuery,
  viewer?: CampViewer,
) {
  const camps = await db.camp.findMany({
    where: buildCampWhere(query),
    ...campArgs,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })

  const classIds = camps.flatMap((camp) => camp.classes.map((item) => item.id))
  const [occupiedSeatMap, enrollments] = await Promise.all([
    loadOccupiedSeatCountMap(classIds),
    viewer?.id
      ? db.campEnrollment.findMany({
          where: {
            userId: viewer.id,
            campId: {
              in: camps.map((item) => item.id),
            },
            status: {
              notIn: ["CANCELED", "REFUNDED"],
            },
          },
          include: {
            campClass: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
  ])

  const enrollmentMap = new Map<string, Awaited<ReturnType<typeof getCampEnrollmentStatus>>>()
  for (const enrollment of enrollments) {
    if (!enrollmentMap.has(enrollment.campId)) {
      enrollmentMap.set(enrollment.campId, {
        id: enrollment.id,
        campId: enrollment.campId,
        classId: enrollment.classId,
        classTitle: enrollment.campClass.title,
        status: enrollment.status,
        sourceType: enrollment.sourceType,
        orderId: enrollment.orderId,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        activatedAt: enrollment.activatedAt?.toISOString() ?? null,
        completedAt: enrollment.completedAt?.toISOString() ?? null,
        lastActiveAt: enrollment.lastActiveAt?.toISOString() ?? null,
      })
    }
  }

  const items = camps.map((camp) => mapCampRecordToItem(camp, occupiedSeatMap, enrollmentMap.get(camp.id) ?? null))

  return {
    items,
    total: items.length,
    q: query.q ?? null,
  }
}

export async function getCampDetail(
  idOrSlug: string,
  viewer?: CampViewer,
): Promise<CampDetailItem | null> {
  const camp = await loadCampRecord(idOrSlug)
  if (!camp || (camp.status !== "published" && !viewer?.roles?.includes("admin"))) {
    return null
  }

  const [occupiedSeatMap, enrollment] = await Promise.all([
    loadOccupiedSeatCountMap(camp.classes.map((item) => item.id)),
    viewer?.id ? getCampEnrollmentStatus(viewer.id, camp.id) : Promise.resolve(null),
  ])

  return {
    ...mapCampRecordToItem(camp, occupiedSeatMap, enrollment),
    description: camp.description,
  }
}

export async function getCampClassDetail(
  idOrSlug: string,
  viewer?: CampViewer,
): Promise<CampClassDetailItem | null> {
  const record = await loadCampClassRecord(idOrSlug)
  if (!record || record.camp.visibility === "hidden") {
    return null
  }

  const occupiedSeatMap = await loadOccupiedSeatCountMap([record.id])
  const campClass = mapCampClass(record as CampClassRecord, occupiedSeatMap.get(record.id) ?? 0)
  const evaluator = await createContentAccessEvaluator(viewer)
  const access = await evaluator.canAccessCamp({
    id: record.id,
    campId: record.campId,
    visibility: record.camp.visibility,
    accessLevel: record.accessLevel || record.camp.accessLevel,
  })

  const [enrollment, previewTasks] = await Promise.all([
    viewer?.id ? getCampClassEnrollmentStatus(viewer.id, record.id) : Promise.resolve(null),
    getCampTaskPreview(record.id),
  ])

  if (!access.allowed) {
    return {
      camp: {
        id: record.camp.id,
        slug: record.camp.slug,
        title: record.camp.title,
        summary: record.camp.summary,
        coverImage: record.camp.coverImage,
        suitableFor: record.camp.suitableFor,
        difficulty: record.camp.difficulty,
      },
      class: campClass,
      access,
      enrollment,
      previewTasks,
      tasks: [],
      ranking: null,
      graduationReport: null,
    }
  }

  const [tasks, ranking, graduationReport] = await Promise.all([
    listCampTasks(record.id, viewer),
    getCampRanking(record.id, viewer?.id ?? null, 20),
    viewer?.id ? getCampGraduationReport(record.id, viewer.id).catch(() => null) : Promise.resolve(null),
  ])

  return {
    camp: {
      id: record.camp.id,
      slug: record.camp.slug,
      title: record.camp.title,
      summary: record.camp.summary,
      coverImage: record.camp.coverImage,
      suitableFor: record.camp.suitableFor,
      difficulty: record.camp.difficulty,
    },
    class: campClass,
    access,
    enrollment,
    previewTasks,
    tasks,
    ranking: ranking.data,
    graduationReport,
  }
}

export async function getCampTasksPayload(
  campId: string,
  classId: string,
  viewer?: CampViewer,
): Promise<CampTasksResponse> {
  const record = await db.campClass.findFirst({
    where: {
      id: classId,
      campId,
    },
    include: {
      camp: true,
    },
  })

  if (!record) {
    throw new CampCenterError("not_found", "训练营班级不存在", 404)
  }

  const evaluator = await createContentAccessEvaluator(viewer)
  const access = await evaluator.canAccessCamp({
    id: record.id,
    campId: record.campId,
    visibility: record.camp.visibility,
    accessLevel: record.accessLevel || record.camp.accessLevel,
  })

  return {
    data: {
      classId: record.id,
      access,
      items: access.allowed ? await listCampTasks(record.id, viewer) : [],
    },
  }
}

export async function getCampRankingPayload(
  campId: string,
  classId: string,
  viewer?: CampViewer,
  limit = 20,
): Promise<CampRankingResponse> {
  const record = await db.campClass.findFirst({
    where: {
      id: classId,
      campId,
    },
    include: {
      camp: true,
    },
  })

  if (!record) {
    throw new CampCenterError("not_found", "训练营班级不存在", 404)
  }

  const evaluator = await createContentAccessEvaluator(viewer)
  const access = await evaluator.canAccessCamp({
    id: record.id,
    campId: record.campId,
    visibility: record.camp.visibility,
    accessLevel: record.accessLevel || record.camp.accessLevel,
  })

  if (!access.allowed) {
    return {
      data: {
        classId: record.id,
        scope: "overall",
        scopeKey: "overall",
        updatedAt: new Date().toISOString(),
        items: [],
      },
    }
  }

  return getCampRanking(record.id, viewer?.id ?? null, limit)
}

export async function getCampGraduationReportPayload(
  campId: string,
  classId: string,
  viewer?: CampViewer,
): Promise<CampGraduationReportResponse> {
  const record = await db.campClass.findFirst({
    where: {
      id: classId,
      campId,
    },
    include: {
      camp: true,
    },
  })

  if (!record) {
    throw new CampCenterError("not_found", "训练营班级不存在", 404)
  }

  const evaluator = await createContentAccessEvaluator(viewer)
  const access = await evaluator.canAccessCamp({
    id: record.id,
    campId: record.campId,
    visibility: record.camp.visibility,
    accessLevel: record.accessLevel || record.camp.accessLevel,
  })

  if (!access.allowed || !viewer?.id) {
    return {
      data: {
        access,
        report: null,
      },
    }
  }

  return {
    data: {
      access,
      report: await getCampGraduationReport(record.id, viewer.id),
    },
  }
}

export async function resolveDefaultCampClassId(campId: string) {
  const campClass = await db.campClass.findFirst({
    where: {
      campId,
      status: {
        in: ["enrolling", "active", "completed"],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }],
    select: {
      id: true,
    },
  })

  return campClass?.id ?? null
}

export async function resolveCampId(idOrSlug: string) {
  const camp = await db.camp.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    select: {
      id: true,
    },
  })

  return camp?.id ?? null
}
