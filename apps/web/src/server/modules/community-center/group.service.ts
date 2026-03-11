import { Prisma } from "@prisma/client"
import type { StudyGroupDetailItem, StudyGroupListItem } from "@/lib/community"
import { db } from "@/lib/db"
import { awardPointsInTx } from "@/server/modules/community-center/points.service"
import { buildUniqueGroupSlug, CommunityError } from "@/server/modules/community-center/shared"

type Viewer = {
  id?: string | null
  roles?: string[]
}

const groupListArgs = Prisma.validator<Prisma.StudyGroupDefaultArgs>()({
  include: {
    owner: {
      select: {
        id: true,
        name: true,
      },
    },
    _count: {
      select: {
        members: true,
        posts: true,
      },
    },
  },
})

type StudyGroupRecord = Prisma.StudyGroupGetPayload<typeof groupListArgs>

function mapGroupListItem(
  group: StudyGroupRecord,
  membership: { joined: boolean; role: string | null },
): StudyGroupListItem {
  return {
    id: group.id,
    slug: group.slug,
    name: group.name,
    summary: group.summary,
    topic: group.topic,
    level: group.level,
    visibility: group.visibility,
    status: group.status,
    memberLimit: group.memberLimit,
    memberCount: group._count.members,
    postCount: group._count.posts,
    owner: group.owner,
    joined: membership.joined,
    role: membership.role,
    createdAt: group.createdAt.toISOString(),
  }
}

async function loadMembershipMap(groupIds: string[], userId?: string | null) {
  if (!userId || groupIds.length === 0) return new Map<string, { joined: boolean; role: string | null }>()

  const rows = await db.studyGroupMember.findMany({
    where: {
      userId,
      groupId: { in: groupIds },
      status: "active",
    },
    select: {
      groupId: true,
      role: true,
    },
  })

  return new Map(rows.map((row) => [row.groupId, { joined: true, role: row.role }]))
}

export async function listStudyGroups(viewer?: Viewer, query?: { q?: string | null }) {
  const groups = await db.studyGroup.findMany({
    where: {
      status: "active",
      visibility: "public",
      ...(query?.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { summary: { contains: query.q, mode: "insensitive" } },
              { topic: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    ...groupListArgs,
    orderBy: [{ createdAt: "desc" }],
    take: 24,
  })

  const membershipMap = await loadMembershipMap(
    groups.map((group) => group.id),
    viewer?.id,
  )

  return groups.map((group) => mapGroupListItem(group, membershipMap.get(group.id) ?? { joined: false, role: null }))
}

export async function getStudyGroupDetail(idOrSlug: string, viewer?: Viewer): Promise<StudyGroupDetailItem | null> {
  const group = await db.studyGroup.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      status: "active",
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
        },
      },
      members: {
        where: { status: "active" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ joinedAt: "asc" }],
        take: 12,
      },
      _count: {
        select: {
          members: true,
          posts: true,
        },
      },
    },
  })

  if (!group) return null

  const membershipMap = await loadMembershipMap([group.id], viewer?.id)
  const base = mapGroupListItem(group, membershipMap.get(group.id) ?? { joined: false, role: null })

  return {
    ...base,
    description: group.description,
    members: group.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user.name,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
  }
}

export async function createStudyGroup(
  userId: string,
  input: {
    name: string
    summary?: string | null
    description?: string | null
    topic?: string | null
    level?: string | null
    memberLimit?: number | null
  },
) {
  return db.$transaction(async (tx) => {
    const slug = await buildUniqueGroupSlug(tx, input.name)

    const group = await tx.studyGroup.create({
      data: {
        ownerId: userId,
        slug,
        name: input.name,
        summary: input.summary ?? null,
        description: input.description ?? null,
        topic: input.topic ?? null,
        level: input.level ?? "mixed",
        visibility: "public",
        status: "active",
        memberLimit: input.memberLimit ?? null,
      },
    })

    await tx.studyGroupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: "owner",
        status: "active",
      },
    })

    await awardPointsInTx(tx, userId, {
      actionType: "study_group_create",
      actionKey: `study_group_create:${group.id}`,
      pointsDelta: 30,
      relatedType: "study_group",
      relatedId: group.id,
      note: `创建学习小组：${group.name}`,
    })

    return group
  })
}

export async function joinStudyGroup(userId: string, groupId: string) {
  return db.$transaction(async (tx) => {
    const group = await tx.studyGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: {
            members: {
              where: { status: "active" },
            },
          },
        },
      },
    })

    if (!group || group.status !== "active") {
      throw new CommunityError("group_not_found", "学习小组不存在", 404)
    }

    const existing = await tx.studyGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    })

    if (existing?.status === "active") {
      return existing
    }

    if (group.memberLimit && group._count.members >= group.memberLimit) {
      throw new CommunityError("group_full", "小组人数已满", 400)
    }

    const member = existing
      ? await tx.studyGroupMember.update({
          where: {
            groupId_userId: {
              groupId,
              userId,
            },
          },
          data: {
            status: "active",
            role: existing.role === "owner" ? "owner" : "member",
            joinedAt: new Date(),
          },
        })
      : await tx.studyGroupMember.create({
          data: {
            groupId,
            userId,
            role: "member",
            status: "active",
          },
        })

    await awardPointsInTx(tx, userId, {
      actionType: "study_group_join",
      actionKey: `study_group_join:${groupId}:${userId}`,
      pointsDelta: 8,
      relatedType: "study_group",
      relatedId: groupId,
      note: `加入学习小组：${group.name}`,
    })

    return member
  })
}
