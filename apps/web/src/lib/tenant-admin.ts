export type TenantOrganizationItem = {
  id: string
  slug: string
  name: string
  shortName?: string | null
  externalCode?: string | null
  type: string
  status: string
  role: string
  memberCount: number
  classCount: number
}

export type TenantClassItem = {
  id: string
  slug: string
  name: string
  code?: string | null
  externalCode?: string | null
  status: string
  groupType: string
  memberCount: number
  owner: {
    id: string
    name?: string | null
    email?: string | null
  }
}

export type TenantClassDetail = TenantClassItem & {
  organization: {
    id: string
    name: string
    slug: string
  }
  assignments: Array<{
    id: string
    title: string
    dueAt?: string | null
    status: string
    maxScore: number
    gradingMode: string
    publishedAt?: string | null
    problemSet: {
      id: string
      title: string
      itemCount: number
    }
    gradeSummary: {
      studentCount: number
      gradedCount: number
      avgScore: number
    }
  }>
  members: Array<{
    userId: string
    memberRole: string
    status: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      phone?: string | null
    }
  }>
}

export type TenantAssignmentItem = {
  id: string
  title: string
  status: string
  note?: string | null
  dueAt?: string | null
  maxScore: number
  gradingMode: string
  publishedAt?: string | null
  problemSet: {
    id: string
    title: string
    itemCount: number
  }
  gradeSummary: {
    studentCount: number
    gradedCount: number
    avgScore: number
    avgCompletionRate: number
  }
}

export type TenantAssignmentGradeRow = {
  userId: string
  name?: string | null
  email?: string | null
  phone?: string | null
  status: string
  autoScore: number
  manualScore?: number | null
  finalScore: number
  maxScore: number
  completionRate: number
  solvedProblemCount: number
  attemptedProblemCount: number
  submissionCount: number
  feedback?: string | null
  lastSubmissionAt?: string | null
  gradedAt?: string | null
  gradedBy?: {
    id: string
    name?: string | null
    email?: string | null
  } | null
}

export type TenantAssignmentDetail = TenantAssignmentItem & {
  classInfo: {
    id: string
    name: string
    slug: string
    organizationId?: string | null
  }
  stats: {
    studentCount: number
    gradedCount: number
    avgScore: number
    avgCompletionRate: number
    completionRate: number
  }
  grades: TenantAssignmentGradeRow[]
}

export type TenantClassStats = {
  summary: {
    studentCount: number
    teacherCount: number
    assignmentCount: number
    assignedProblemCount: number
    activeStudentCount: number
    totalSubmissions: number
    solvedStudentProblemCount: number
    avgCompletionRate: number
    lastActivityAt?: string | null
  }
  assignments: Array<{
    assignmentId: string
    title: string
    problemCount: number
    dueAt?: string | null
    startedStudentCount: number
    completedStudentCount: number
    avgCompletionRate: number
  }>
  members: Array<{
    userId: string
    name?: string | null
    email?: string | null
    phone?: string | null
    memberRole: string
    status: string
    attemptedProblemCount: number
    solvedProblemCount: number
    submissionCount: number
    completionRate: number
    lastActiveAt?: string | null
  }>
}

export type TenantApiKeyItem = {
  id: string
  name: string
  status: string
  expiresAt?: string | null
  lastUsedAt?: string | null
  createdAt: string
}

export type TenantOrganizationsResponse = { data: TenantOrganizationItem[] }
export type TenantClassesResponse = { data: TenantClassItem[] }
export type TenantClassDetailResponse = { data: TenantClassDetail }
export type TenantClassStatsResponse = { data: TenantClassStats }
export type TenantAssignmentsResponse = { data: TenantAssignmentItem[] }
export type TenantAssignmentDetailResponse = { data: TenantAssignmentDetail }
export type TenantApiKeysResponse = { data: TenantApiKeyItem[] }

export type TenantCreateOrganizationInput = {
  slug?: string
  name: string
  shortName?: string
  externalCode?: string
  type?: string
  status?: string
  description?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  adminIdentifier: string
  adminName?: string
}

export type TenantCreateUserInput = {
  name?: string
  email?: string
  phone?: string
  title?: string
  bio?: string
  specialties?: string[]
}

export type TenantCreateClassInput = {
  slug?: string
  name: string
  code?: string
  externalCode?: string
  summary?: string
  startAt?: string
  endAt?: string
}

export type TenantCreateAssignmentInput = {
  problemSetId: string
  title?: string
  note?: string
  dueAt?: string
  maxScore?: number
  gradingMode?: string
  publishNow?: boolean
}

export type TenantUpdateAssignmentGradeInput = {
  manualScore?: number | null
  feedback?: string
}

export type TenantCreateApiKeyInput = {
  name: string
  expiresAt?: string
}
