export type OrganizationItem = {
  id: string
  slug: string
  name: string
  shortName?: string | null
  type: string
  status: string
  description?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  memberCount: number
  teacherCount: number
  groupCount: number
  createdAt: string
  updatedAt: string
}

export type OrganizationDetail = OrganizationItem & {
  teachers: TeacherProfileItem[]
  groups: TeachingGroupItem[]
}

export type TeacherProfileItem = {
  userId: string
  displayName?: string | null
  title?: string | null
  bio?: string | null
  specialties: string[]
  status: string
  organization?: {
    id: string
    name: string
  } | null
  user: {
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
    status: string
  }
  createdAt: string
  updatedAt: string
}

export type TeachingGroupItem = {
  id: string
  slug: string
  name: string
  code?: string | null
  groupType: string
  status: string
  summary?: string | null
  organization?: {
    id: string
    name: string
  } | null
  owner: {
    id: string
    name?: string | null
    email?: string | null
  }
  memberCount: number
  startAt?: string | null
  endAt?: string | null
  createdAt: string
  updatedAt: string
}

export type TeachingGroupAssignmentItem = {
  id: string
  status: string
  title?: string | null
  note?: string | null
  dueAt?: string | null
  createdAt: string
  problemSet: {
    id: string
    title: string
    visibility: string
    itemCount: number
  }
  assignedBy: {
    id: string
    name?: string | null
    email?: string | null
  }
}

export type TeachingGroupDetail = TeachingGroupItem & {
  members: Array<{
    userId: string
    memberRole: string
    status: string
    joinedAt: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      phone?: string | null
      status: string
    }
  }>
  campClasses: Array<{
    id: string
    slug: string
    title: string
    status: string
    startAt: string
    endAt: string
  }>
  assignments: TeachingGroupAssignmentItem[]
}

export type TeachingGroupStats = {
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

export type OrganizationsResponse = { data: OrganizationItem[] }
export type OrganizationDetailResponse = { data: OrganizationDetail }
export type TeacherProfilesResponse = { data: TeacherProfileItem[] }
export type TeachingGroupsResponse = { data: TeachingGroupItem[] }
export type TeachingGroupDetailResponse = { data: TeachingGroupDetail }
export type TeachingGroupStatsResponse = { data: TeachingGroupStats }

export type OrganizationInput = {
  slug?: string
  name: string
  shortName?: string
  type?: string
  status?: string
  description?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export type TeacherProfileInput = {
  userIdentifier: string
  organizationId?: string
  displayName?: string
  title?: string
  bio?: string
  specialties?: string[]
  status?: string
}

export type TeachingGroupInput = {
  organizationId?: string
  ownerIdentifier: string
  slug?: string
  name: string
  code?: string
  groupType?: string
  status?: string
  summary?: string
  startAt?: string
  endAt?: string
}

export type TeachingGroupMembersInput = {
  members: Array<{
    userIdentifier: string
    memberRole?: string
    status?: string
  }>
}

export type TeachingGroupMemberImportInput = {
  lines: string
  defaultRole?: string
}

export type TeachingGroupAssignmentInput = {
  problemSetId: string
  title?: string
  note?: string
  dueAt?: string
  status?: string
}
