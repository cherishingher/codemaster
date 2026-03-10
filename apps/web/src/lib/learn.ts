import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const VIDEO_MEMBERSHIP_TYPE = "video_membership";

export const DEFAULT_VIDEO_MEMBERSHIP = {
  name: "视频学习付费版",
  priceCents: 29900,
  validDays: 365,
  type: VIDEO_MEMBERSHIP_TYPE,
} as const;

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

function canWatchLesson(plan: LearnPlan, isPreview: boolean) {
  return plan === "paid" || isPreview;
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
  const isAdmin = roles.includes("admin");

  const activeEntitlement = isAdmin
    ? true
    : Boolean(
        await db.entitlement.findFirst({
          where: {
            userId: session.userId,
            product: { type: VIDEO_MEMBERSHIP_TYPE },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      );

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

export async function getVideoMembershipProduct() {
  const product = await db.product.findFirst({
    where: { type: VIDEO_MEMBERSHIP_TYPE },
    orderBy: { priceCents: "asc" },
  });

  return (
    product ?? {
      id: "video-membership-default",
      ...DEFAULT_VIDEO_MEMBERSHIP,
    }
  );
}

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

  const sections: LearnSectionItem[] = course.sections.map((section) => ({
    id: section.id,
    slug: section.slug,
    title: section.title,
    description: section.description,
    sortOrder: section.sortOrder,
    lessons: section.lessons.map((lesson) => {
      const allowed = canWatchLesson(viewer.plan, lesson.isPreview);
      return {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        type: lesson.type,
        summary: lesson.summary,
        content: lesson.content,
        assetUri: lesson.assetUri,
        thumbnailUrl: lesson.thumbnailUrl,
        durationSec: lesson.durationSec,
        isPreview: lesson.isPreview,
        canWatch: allowed,
        isLocked: !allowed,
        sortOrder: lesson.sortOrder,
      };
    }),
  }));

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
