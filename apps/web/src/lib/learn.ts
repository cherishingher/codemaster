import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import type { ContentAccessResult } from "@/lib/content-access";
import { db } from "@/lib/db";
import { createContentAccessEvaluator } from "@/server/modules/content-access/service";
import { ensureVipMembershipProduct, hasActiveVipMembership } from "@/server/modules/membership/service";

export type LearnPlan = "guest" | "free" | "paid";

export type LearnViewer = {
  userId: string | null;
  name: string | null;
  email: string | null;
  roles: string[];
  plan: LearnPlan;
  isLoggedIn: boolean;
};

export type LearnCourseCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  coverImage: string | null;
  sortOrder: number;
  sectionCount: number;
  lessonCount: number;
  previewCount: number;
  paidLessonCount: number;
  totalDurationSec: number;
};

export type LearnLessonItem = {
  id: string;
  slug: string;
  title: string;
  type: string;
  summary: string | null;
  content: string | null;
  assetUri: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  isPreview: boolean;
  canWatch: boolean;
  isLocked: boolean;
  access: ContentAccessResult;
  sortOrder: number;
};

export type LearnSectionItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: LearnLessonItem[];
};

export type LearnCourseDetail = LearnCourseCard & {
  sections: LearnSectionItem[];
  selectedLesson: LearnLessonItem | null;
};

function emptyViewer(): LearnViewer {
  return {
    userId: null,
    name: null,
    email: null,
    roles: [],
    plan: "guest",
    isLoggedIn: false,
  };
}

function normalizeViewerPlan({
  isLoggedIn,
  isPaid,
}: {
  isLoggedIn: boolean;
  isPaid: boolean;
}): LearnPlan {
  if (!isLoggedIn) return "guest";
  return isPaid ? "paid" : "free";
}

export async function getLearnViewerByToken(token?: string | null): Promise<LearnViewer> {
  if (!token) {
    return emptyViewer();
  }

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          roles: {
            include: { role: true },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return emptyViewer();
  }

  const roles = session.user.roles.map((entry) => entry.role.name);
  const activeEntitlement = await hasActiveVipMembership(session.userId, roles);

  return {
    userId: session.userId,
    name: session.user.name,
    email: session.user.email,
    roles,
    plan: normalizeViewerPlan({
      isLoggedIn: true,
      isPaid: activeEntitlement,
    }),
    isLoggedIn: true,
  };
}

export async function getLearnViewerFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cm_session")?.value ?? null;
  return getLearnViewerByToken(token);
}

export async function getVipMembershipProduct() {
  const product = await db.$transaction(async (tx) => ensureVipMembershipProduct(tx));

  return {
    id: product.id,
    name: product.name,
    priceCents: product.priceCents,
    validDays: product.validDays,
    type: product.type,
  };
}

export const getVideoMembershipProduct = getVipMembershipProduct;

function mapCourseCard(
  course: Prisma.CourseGetPayload<{
    include: {
      sections: {
        include: {
          lessons: true;
        };
      };
    };
  }>,
): LearnCourseCard {
  const lessons = course.sections.flatMap((section) => section.lessons);
  const previewCount = lessons.filter((lesson) => lesson.isPreview).length;
  const totalDurationSec = lessons.reduce((sum, lesson) => sum + (lesson.durationSec ?? 0), 0);

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    description: course.description,
    category: course.category,
    coverImage: course.coverImage,
    sortOrder: course.sortOrder,
    sectionCount: course.sections.length,
    lessonCount: lessons.length,
    previewCount,
    paidLessonCount: Math.max(lessons.length - previewCount, 0),
    totalDurationSec,
  };
}

async function getPublishedCourses() {
  return db.course.findMany({
    where: { status: "published" },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      sections: {
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        include: {
          lessons: {
            where: {
              status: "published",
            },
            orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          },
        },
      },
    },
  });
}

export async function getLearnCourseCards() {
  const courses = await getPublishedCourses();
  return courses.map((course) => mapCourseCard(course));
}

export async function getFeaturedLearnCourses(limit = 3) {
  const cards = await getLearnCourseCards();
  return cards.slice(0, limit);
}

export async function getLearnLibraryData() {
  const [viewer, product, courses] = await Promise.all([
    getLearnViewerFromCookies(),
    getVideoMembershipProduct(),
    getLearnCourseCards(),
  ]);

  return { viewer, product, courses };
}

export async function getLearnCourseDetail(slug: string, selectedLessonSlug?: string | null) {
  const [viewer, product, course] = await Promise.all([
    getLearnViewerFromCookies(),
    getVideoMembershipProduct(),
    db.course.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
          include: {
            lessons: {
              where: {
                status: "published",
              },
              orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
            },
          },
        },
      },
    }),
  ]);

  if (!course || course.status !== "published") {
    return { viewer, product, course: null as LearnCourseDetail | null };
  }

  const evaluator = await createContentAccessEvaluator({
    id: viewer.userId,
    roles: viewer.roles,
  })

  const sections: LearnSectionItem[] = course.sections.map((section) => ({
    id: section.id,
    slug: section.slug,
    title: section.title,
    description: section.description,
    sortOrder: section.sortOrder,
    lessons: [],
  }));

  for (let sectionIndex = 0; sectionIndex < course.sections.length; sectionIndex += 1) {
    const section = course.sections[sectionIndex]
    const mappedLessons: LearnLessonItem[] = []

    for (const lesson of section.lessons) {
      const access = await evaluator.canAccessLesson({
        id: lesson.id,
        courseId: course.id,
        isPreview: lesson.isPreview,
      })

      const allowed = access.allowed
      mappedLessons.push({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        type: lesson.type,
        summary: lesson.summary,
        content: allowed ? lesson.content : null,
        assetUri: allowed ? lesson.assetUri : null,
        thumbnailUrl: lesson.thumbnailUrl,
        durationSec: lesson.durationSec,
        isPreview: lesson.isPreview,
        canWatch: allowed,
        isLocked: !allowed,
        access,
        sortOrder: lesson.sortOrder,
      })
    }

    sections[sectionIndex].lessons = mappedLessons
  }

  const allLessons = sections.flatMap((section) => section.lessons);
  const selectedLesson =
    allLessons.find((lesson) => lesson.slug === selectedLessonSlug) ??
    allLessons.find((lesson) => lesson.canWatch) ??
    allLessons[0] ??
    null;

  const detail: LearnCourseDetail = {
    ...mapCourseCard(course),
    sections,
    selectedLesson,
  };

  return { viewer, product, course: detail };
}

export function groupCoursesByCategory(courses: LearnCourseCard[]) {
  const groups = new Map<string, LearnCourseCard[]>();

  for (const course of courses) {
    const key = course.category?.trim() || "未分类";
    const bucket = groups.get(key) ?? [];
    bucket.push(course);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}
