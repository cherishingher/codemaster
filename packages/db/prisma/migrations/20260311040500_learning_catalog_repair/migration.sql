ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "validDays" INTEGER;

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "coverImage" TEXT,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Section"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "content" TEXT,
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "isPreview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_course_slugs AS (
  SELECT
    c."id",
    CASE
      WHEN regexp_replace(lower(coalesce(c."title", '')), '[^a-z0-9]+', '-', 'g') = '' THEN 'course'
      ELSE trim(both '-' FROM regexp_replace(lower(coalesce(c."title", '')), '[^a-z0-9]+', '-', 'g'))
    END AS base_slug,
    row_number() OVER (
      PARTITION BY CASE
        WHEN regexp_replace(lower(coalesce(c."title", '')), '[^a-z0-9]+', '-', 'g') = '' THEN 'course'
        ELSE trim(both '-' FROM regexp_replace(lower(coalesce(c."title", '')), '[^a-z0-9]+', '-', 'g'))
      END
      ORDER BY c."id"
    ) AS rn
  FROM "Course" c
  WHERE c."slug" IS NULL
)
UPDATE "Course" c
SET "slug" = CASE
  WHEN r.rn = 1 THEN r.base_slug || '-' || left(c."id", 6)
  ELSE r.base_slug || '-' || left(c."id", 6) || '-' || r.rn
END
FROM ranked_course_slugs r
WHERE c."id" = r."id";

WITH ranked_section_slugs AS (
  SELECT
    s."id",
    CASE
      WHEN regexp_replace(lower(coalesce(s."title", '')), '[^a-z0-9]+', '-', 'g') = '' THEN 'section'
      ELSE trim(both '-' FROM regexp_replace(lower(coalesce(s."title", '')), '[^a-z0-9]+', '-', 'g'))
    END AS base_slug,
    row_number() OVER (
      PARTITION BY CASE
        WHEN regexp_replace(lower(coalesce(s."title", '')), '[^a-z0-9]+', '-', 'g') = '' THEN 'section'
        ELSE trim(both '-' FROM regexp_replace(lower(coalesce(s."title", '')), '[^a-z0-9]+', '-', 'g'))
      END
      ORDER BY s."id"
    ) AS rn
  FROM "Section" s
  WHERE s."slug" IS NULL
)
UPDATE "Section" s
SET "slug" = CASE
  WHEN r.rn = 1 THEN r.base_slug || '-' || left(s."id", 6)
  ELSE r.base_slug || '-' || left(s."id", 6) || '-' || r.rn
END
FROM ranked_section_slugs r
WHERE s."id" = r."id";

WITH ranked_lesson_slugs AS (
  SELECT
    l."id",
    CASE
      WHEN regexp_replace(lower(coalesce(l."title", '')), '[^a-z0-9]+', '-', 'g') = '' THEN 'lesson'
      ELSE trim(both '-' FROM regexp_replace(lower(coalesce(l."title", '')), '[^a-z0-9]+', '-', 'g'))
    END AS base_slug,
    row_number() OVER (
      PARTITION BY CASE
        WHEN regexp_replace(lower(coalesce(l."title", '')), '[^a-z0-9]+', '-', 'g') = '' THEN 'lesson'
        ELSE trim(both '-' FROM regexp_replace(lower(coalesce(l."title", '')), '[^a-z0-9]+', '-', 'g'))
      END
      ORDER BY l."id"
    ) AS rn
  FROM "Lesson" l
  WHERE l."slug" IS NULL
)
UPDATE "Lesson" l
SET "slug" = CASE
  WHEN r.rn = 1 THEN r.base_slug || '-' || left(l."id", 6)
  ELSE r.base_slug || '-' || left(l."id", 6) || '-' || r.rn
END
FROM ranked_lesson_slugs r
WHERE l."id" = r."id";

ALTER TABLE "Course"
  ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "Section"
  ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "Lesson"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Course_slug_key" ON "Course"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Section_slug_key" ON "Section"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Lesson_slug_key" ON "Lesson"("slug");

CREATE INDEX IF NOT EXISTS "Course_status_sortOrder_idx" ON "Course"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "Course_category_sortOrder_idx" ON "Course"("category", "sortOrder");
CREATE INDEX IF NOT EXISTS "Section_courseId_sortOrder_idx" ON "Section"("courseId", "sortOrder");
CREATE INDEX IF NOT EXISTS "Lesson_sectionId_sortOrder_idx" ON "Lesson"("sectionId", "sortOrder");
