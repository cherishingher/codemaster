# Problem Bank DB Design

This document describes the incremental LeetCode-style problem bank schema that was added on top of the existing CodeMaster OJ schema. The implementation keeps the current `Problem / ProblemVersion / Testcase / Submission` flow intact and extends it with slug routing, current-version pointers, language-specific judge configs, split submission artifacts, testcase visibility control, and user-problem aggregates.

## Design Principles
- Keep the current PostgreSQL + Prisma main database as the source of truth.
- Preserve HUSTOJ compatibility by storing judge outcomes in HUSTOJ-style integer codes alongside the existing short string statuses.
- Avoid breaking existing APIs by extending current tables first and only splitting data where it improves operability.
- Never expose hidden testcase bodies through public problem or submission APIs.

## Enum Conventions
The schema stores these values as integers to stay compatible with HUSTOJ-style result codes and legacy admin operations.

### `difficulty`
- `1`: easy
- `2`: medium
- `3`: hard
- `4`: expert / custom extension

### `problem_status`
- `0`: draft
- `10`: review
- `20`: published
- `30`: archived

### `submission_status` (`Submission.judgeResult`)
- `0`: pending / waiting
- `1`: rejudging / reserved
- `2`: compiling or judging
- `3`: compiled / reserved
- `4`: accepted
- `5`: presentation error
- `6`: wrong answer
- `7`: time limit exceeded
- `8`: memory limit exceeded
- `9`: output limit exceeded
- `10`: runtime error
- `11`: compile error
- `12`: partial accepted
- `13`: failed / system error

### `case_status` (`SubmissionCase.judgeResult`)
- Uses the same integer mapping as `submission_status`

### `user_problem_status`
- `0`: not started
- `10`: attempted
- `20`: accepted

### `testcase_type`
- `0`: sample
- `1`: hidden
- `2`: stress

## Table Mapping

### `problems` -> `Problem`
Purpose: problem identity, lifecycle, routing, and cached statistics.

Fields:
- `id TEXT PRIMARY KEY`
- `slug TEXT NOT NULL UNIQUE`
- `title TEXT NOT NULL`
- `difficulty INTEGER NOT NULL`
- `status INTEGER NOT NULL DEFAULT 0`
- `visible BOOLEAN NOT NULL DEFAULT true`
- `defunct CHAR(1) NOT NULL DEFAULT 'N'`
- `visibility TEXT NOT NULL DEFAULT 'public'`
- `source TEXT NULL`
- `publishedAt TIMESTAMP NULL`
- `totalSubmissions INTEGER NOT NULL DEFAULT 0`
- `acceptedSubmissions INTEGER NOT NULL DEFAULT 0`
- `passRate DOUBLE PRECISION NOT NULL DEFAULT 0`
- `currentVersionId TEXT NULL UNIQUE`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK: `id`
- Unique: `slug`
- Unique: `currentVersionId`
- FK: `currentVersionId -> ProblemVersion.id` with `ON DELETE SET NULL`

Indexes:
- `problems.slug` unique lookup
- `(status, visible, defunct, publishedAt)` for public list pages
- `(createdAt)` for admin ordering
- Existing difficulty index kept for list filters

Reasoning:
- `slug` supports stable LeetCode-style routes.
- `currentVersionId` decouples published statement selection from “latest version”.
- `visible + defunct` keeps HUSTOJ-like soft hide / soft offline controls for admin operations.
- Cached counters remove expensive list-page aggregates.

### `problem_versions` -> `ProblemVersion`
Purpose: versioned statements, samples, limits, Scratch rules, and version-local judge configs.

Fields:
- `id TEXT PRIMARY KEY`
- `problemId TEXT NOT NULL`
- `version INTEGER NOT NULL`
- `statement TEXT NOT NULL`
- `statementMd TEXT NULL`
- `constraints TEXT NULL`
- `hints TEXT NULL`
- `inputFormat TEXT NULL`
- `outputFormat TEXT NULL`
- `samples JSON NULL`
- `scratchRules JSON NULL`
- `notes TEXT NULL`
- `timeLimitMs INTEGER NOT NULL`
- `memoryLimitMb INTEGER NOT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK: `id`
- Unique: `(problemId, version)`
- FK: `problemId -> Problem.id`

Indexes:
- `(problemId)`
- `(problemId, createdAt)`

Reasoning:
- Statement versions are immutable snapshots.
- `statementMd` lets the system evolve from plain text to richer Markdown rendering without destroying legacy content.
- Limits stay on the version because they belong to the statement and testcase set the user sees.

### `tags` -> `Tag`
Purpose: global tag dictionary.

Fields:
- `id TEXT PRIMARY KEY`
- `name TEXT NOT NULL UNIQUE`

Constraints:
- PK: `id`
- Unique: `name`

### `problem_tags` -> `ProblemTag`
Purpose: many-to-many join between problems and tags.

Fields:
- `problemId TEXT NOT NULL`
- `tagId TEXT NOT NULL`

Constraints:
- Composite PK: `(problemId, tagId)`
- FK: `problemId -> Problem.id`
- FK: `tagId -> Tag.id`

Indexes:
- `(tagId)` for reverse tag filtering

### `problem_judge_configs` -> `ProblemJudgeConfig`
Purpose: per-version, per-language judge/runtime configuration.

Fields:
- `id TEXT PRIMARY KEY`
- `versionId TEXT NOT NULL`
- `language TEXT NOT NULL`
- `languageId INTEGER NOT NULL`
- `judgeMode TEXT NOT NULL DEFAULT 'standard'`
- `timeLimitMs INTEGER NULL`
- `memoryLimitMb INTEGER NULL`
- `templateCode TEXT NULL`
- `templateCodeUri TEXT NULL`
- `entrypoint TEXT NULL`
- `entrySignature TEXT NULL`
- `compileCommand TEXT NULL`
- `runCommand TEXT NULL`
- `isEnabled BOOLEAN NOT NULL DEFAULT true`
- `isDefault BOOLEAN NOT NULL DEFAULT false`
- `sortOrder INTEGER NOT NULL DEFAULT 0`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK: `id`
- Unique: `(versionId, language)`
- FK: `versionId -> ProblemVersion.id`

Indexes:
- `(versionId, isEnabled, sortOrder)`
- `(languageId)`

Reasoning:
- One problem version can expose different templates and limits for C++ / Python / Scratch.
- `languageId` stores the HUSTOJ-compatible numeric language identity used during judge bridging.
- `judgeMode` lets the same problem version support normal code, Scratch, or future special-judge paths.

### `problem_testcases` -> `Testcase`
Purpose: testcase registry scoped to a problem version.

Fields:
- `id TEXT PRIMARY KEY`
- `versionId TEXT NOT NULL`
- `title TEXT NULL`
- `caseType INTEGER NOT NULL DEFAULT 1`
- `visible BOOLEAN NOT NULL DEFAULT false`
- `inputUri TEXT NOT NULL`
- `outputUri TEXT NOT NULL`
- `score INTEGER NOT NULL`
- `timeLimitMs INTEGER NULL`
- `memoryLimitKb INTEGER NULL`
- `subtaskId INTEGER NULL`
- `isPretest BOOLEAN NOT NULL DEFAULT false`
- `groupId TEXT NULL`
- `isSample BOOLEAN NOT NULL DEFAULT false`
- `orderIndex INTEGER NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK: `id`
- FK: `versionId -> ProblemVersion.id`

Indexes:
- `(versionId)`
- `(versionId, caseType, orderIndex)`
- `(versionId, groupId)`

Reasoning:
- `caseType` provides a first-class public/sample/hidden/stress split.
- `visible` supports future preview-only cases without leaking hidden I/O.
- Existing `inputUri/outputUri` stay in object storage and are never returned in public detail APIs.

### `submissions` -> `Submission`
Purpose: submission header, lifecycle, and judge summary. This is the HUSTOJ `solution` equivalent in the main business DB.

Fields:
- `id TEXT PRIMARY KEY`
- `userId TEXT NOT NULL`
- `problemId TEXT NOT NULL`
- `problemVersionId TEXT NOT NULL`
- `lang TEXT NOT NULL`
- `languageId INTEGER NULL`
- `codeUri TEXT NULL`
- `code TEXT NULL`
- `status TEXT NOT NULL DEFAULT 'QUEUED'`
- `judgeResult INTEGER NOT NULL DEFAULT 0`
- `score INTEGER NOT NULL DEFAULT 0`
- `judgeBackend TEXT NOT NULL DEFAULT 'hustoj'`
- `hustojSolutionId INTEGER NULL`
- `timeUsedMs INTEGER NULL`
- `memoryUsedKb INTEGER NULL`
- `visible BOOLEAN NOT NULL DEFAULT true`
- `defunct CHAR(1) NOT NULL DEFAULT 'N'`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `finishedAt TIMESTAMP NULL`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK: `id`
- FK: `userId -> User.id`
- FK: `problemId -> Problem.id`
- FK: `problemVersionId -> ProblemVersion.id`

Indexes:
- `(userId, createdAt)`
- `(problemId, createdAt)`
- `(problemVersionId, createdAt)`
- `(status)`
- `(judgeResult, createdAt)`

Reasoning:
- Keeps current submission flow working while adding `judgeResult`, `finishedAt`, and resource summaries needed by modern submission UIs.
- `visible + defunct` allow moderation and soft hiding.
- Legacy `code/codeUri` remain for backward compatibility while new split tables become the preferred write path.

### `source_codes` -> `SourceCode`
Purpose: one-to-one source artifact split, equivalent to HUSTOJ `source_code`.

Fields:
- `submissionId TEXT PRIMARY KEY`
- `source TEXT NULL`
- `objectKey TEXT NULL`
- `storageType TEXT NOT NULL DEFAULT 'inline'`
- `sourceSize INTEGER NULL`
- `sourceHash TEXT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK + FK: `submissionId -> Submission.id`

Reasoning:
- Keeps large code payloads separable from submission headers.
- Supports future migration to object storage without changing the API contract.

### `compile_infos` -> `CompileInfo`
Purpose: one-to-one compiler metadata split, equivalent to HUSTOJ `compileinfo`.

Fields:
- `submissionId TEXT PRIMARY KEY`
- `compiler TEXT NULL`
- `command TEXT NULL`
- `exitCode INTEGER NULL`
- `message TEXT NULL`
- `objectKey TEXT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK + FK: `submissionId -> Submission.id`

### `runtime_infos` -> `RuntimeInfo`
Purpose: one-to-one runtime / checker metadata split, equivalent to HUSTOJ `runtimeinfo`.

Fields:
- `submissionId TEXT PRIMARY KEY`
- `exitCode INTEGER NULL`
- `signal TEXT NULL`
- `stdoutPreview TEXT NULL`
- `stderrPreview TEXT NULL`
- `checkerMessage TEXT NULL`
- `objectKey TEXT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- PK + FK: `submissionId -> Submission.id`

### `submission_cases` -> `SubmissionCase`
Purpose: per-testcase results with preview-safe fields. Strongly aligned with modern verdict detail pages.

Fields:
- `id TEXT PRIMARY KEY`
- `submissionId TEXT NOT NULL`
- `testcaseId TEXT NULL`
- `ordinal INTEGER NULL`
- `status TEXT NOT NULL`
- `judgeResult INTEGER NOT NULL DEFAULT 0`
- `timeMs INTEGER NOT NULL`
- `memoryMb INTEGER NOT NULL`
- `score INTEGER NOT NULL`
- `inputPreview TEXT NULL`
- `outputPreview TEXT NULL`
- `expectedPreview TEXT NULL`
- `checkerMessage TEXT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`

Constraints:
- PK: `id`
- Unique: `(submissionId, testcaseId)`
- FK: `submissionId -> Submission.id`
- FK: `testcaseId -> Testcase.id` with `ON DELETE SET NULL`

Indexes:
- `(submissionId)`
- `(submissionId, ordinal)`

Reasoning:
- `ordinal` keeps stable ordering for UI rendering.
- `*_Preview` fields intentionally store truncated or safe snippets instead of raw hidden testcase bodies.

### `user_problem_stats` -> `UserProblemProgress`
Purpose: user-problem aggregate used for list-page acceleration.

Fields:
- `userId TEXT NOT NULL`
- `problemId TEXT NOT NULL`
- `status INTEGER NOT NULL DEFAULT 0`
- `attempts INTEGER NOT NULL DEFAULT 0`
- `bestScore INTEGER NOT NULL DEFAULT 0`
- `lastStatus TEXT NULL`
- `solvedAt TIMESTAMP NULL`
- `lastSubmissionId TEXT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT now()`
- `updatedAt TIMESTAMP NOT NULL`

Constraints:
- Composite PK: `(userId, problemId)`
- FK: `userId -> User.id`
- FK: `problemId -> Problem.id`
- FK: `lastSubmissionId -> Submission.id`

Indexes:
- `(problemId, solvedAt)`
- `(userId, status, updatedAt)`

Reasoning:
- The conceptual requirement is `user_problem_stats`; the repo already had `UserProblemProgress`, so this implementation extends that existing table instead of creating a duplicate aggregate source.

## Security Strategy
- Public problem detail APIs return only `samples` from `ProblemVersion`; they never expose hidden testcase I/O from `Testcase`.
- Submission detail APIs expose testcase previews only when the testcase is public/sample or the requester is an admin.
- `SourceCode`, `CompileInfo`, and `RuntimeInfo` should remain owner-or-admin readable. Current API already enforces owner/admin on submission detail.
- Hidden testcase `inputUri/outputUri` should only be reachable in admin-only flows or judge workers.
- `visible=false` or `defunct='Y'` problems should be excluded from public list/detail routes unless the requester is an admin.

## Minimal API Surface Added
- `GET /api/problems`
  - Filters: `keyword|q`, `difficulty`, `tag|tags`, `status`, `userStatus`, `page`, `limit`
- `GET /api/problems/:idOrSlug`
  - Returns current version, tags, judge configs, and samples only
- `POST /api/problems/:idOrSlug/submit`
  - Creates `Submission` + `SourceCode`
- `GET /api/submissions`
  - Paginated current-user submission list
- `GET /api/submissions/:id`
  - Owner/admin-only submission detail with compile/runtime info and safe testcase previews

## Migration Notes
- The migration backfills `slug`, `currentVersionId`, cached counters, judge result codes, testcase type/visibility, and split `SourceCode` rows from legacy data.
- Existing `Submission.code` is preserved during the transition for backward compatibility.
- Existing `ProblemStat` continues to exist; its values are copied into the new cached columns on `Problem` and kept in sync by judge result application code.
