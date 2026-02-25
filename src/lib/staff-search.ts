import type { Prisma } from "@prisma/client"

import { db } from "./db"
import {
  normalizeNameValue,
  scoreNameMatch,
  tokenizeName,
  type TokenMatch
} from "./name-search"

export type StaffSearchMatch = {
  id: string
  name: string
  unitId: string
  unitCode: string | null
  projectId: string | null
  projectName: string | null
  score: number
  pendingAdvanceCount: number
  pendingAdvanceAmount: number
  pendingAdvanceIds: string[]
  tokens: string[]
  matchBreakdown: TokenMatch[]
}

export type StaffResolution = {
  staff: StaffSearchMatch | null
  matches: StaffSearchMatch[]
  normalizedQuery: string | null
  tokens: string[]
}

type StaffSearchOptions = {
  query: string
  projectId?: string | null
  limit?: number
  onlyWithPendingAdvances?: boolean
}

type StaffReferenceOptions = {
  staffId?: string | null
  staffQuery?: string | null
  projectId?: string | null
  matchLimit?: number
  onlyWithPendingAdvances?: boolean
}

function buildProjectFilter(projectId: string): Prisma.StaffWhereInput {
  return {
    OR: [
      {
        unit: {
          projectId
        }
      },
      {
        projectAssignments: {
          some: {
            projectId
          }
        }
      }
    ]
  }
}

function mapStaffToMatch(
  staff: Prisma.StaffGetPayload<{ include: typeof staffInclude }>,
  query: string
) {
  const { score, normalizedCandidate, matches } = scoreNameMatch(query, staff.name)

  const pendingAdvances = staff.advances || []
  const pendingAdvanceCount = pendingAdvances.length
  const pendingAdvanceAmount = pendingAdvances.reduce((sum, advance) => sum + (advance.amount ?? 0), 0)

  return {
    id: staff.id,
    name: staff.name,
    unitId: staff.unit?.id ?? staff.unitId,
    unitCode: staff.unit?.code ?? null,
    projectId: staff.unit?.projectId ?? null,
    projectName: staff.unit?.project?.name ?? null,
    score: Number(score.toFixed(4)),
    pendingAdvanceCount,
    pendingAdvanceAmount,
    pendingAdvanceIds: pendingAdvances.map((advance) => advance.id),
    tokens: tokenizeName(normalizedCandidate),
    matchBreakdown: matches
  }
}

const staffInclude = {
  unit: {
    select: {
      id: true,
      code: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  advances: {
    where: {
      status: "PENDING"
    },
    select: {
      id: true,
      amount: true
    }
  }
} satisfies Prisma.StaffInclude

export async function searchStaffByName(options: StaffSearchOptions): Promise<StaffResolution> {
  const { query, projectId, limit = 10, onlyWithPendingAdvances = false } = options
  const normalizedQuery = normalizeNameValue(query)
  const tokens = tokenizeName(normalizedQuery)

  if (!normalizedQuery || tokens.length === 0) {
    return {
      staff: null,
      matches: [],
      normalizedQuery,
      tokens: []
    }
  }

  const whereClauses: Prisma.StaffWhereInput[] = []

  whereClauses.push({
    AND: tokens.map((token) => ({
      name: {
        contains: token,
        mode: "insensitive"
      }
    }))
  })

  if (projectId) {
    whereClauses.push(buildProjectFilter(projectId))
  }

  if (onlyWithPendingAdvances) {
    whereClauses.push({
      advances: {
        some: {
          status: "PENDING"
        }
      }
    })
  }

  const where: Prisma.StaffWhereInput =
    whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses }

  const rawMatches = await db.staff.findMany({
    where,
    take: Math.min(limit * 3, 50),
    include: staffInclude
  })

  const matches = rawMatches
    .map((staff) => mapStaffToMatch(staff, normalizedQuery))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return {
    staff: matches.length === 1 ? matches[0] : null,
    matches,
    normalizedQuery,
    tokens
  }
}

async function fetchStaffById(staffId: string): Promise<StaffSearchMatch | null> {
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    include: staffInclude
  })

  if (!staff) {
    return null
  }

  return mapStaffToMatch(staff, staff.name)
}

export async function resolveStaffReference(
  options: StaffReferenceOptions
): Promise<StaffResolution> {
  const { staffId, staffQuery, projectId, matchLimit = 8, onlyWithPendingAdvances } = options

  let matches: StaffSearchMatch[] = []
  let normalizedQuery: string | null = null
  let tokens: string[] = []

  if (staffQuery) {
    const searchResult = await searchStaffByName({
      query: staffQuery,
      projectId: projectId ?? undefined,
      limit: matchLimit,
      onlyWithPendingAdvances: onlyWithPendingAdvances ?? false
    })
    matches = searchResult.matches
    normalizedQuery = searchResult.normalizedQuery
    tokens = searchResult.tokens
  }

  let staff: StaffSearchMatch | null = null

  if (staffId) {
    staff = await fetchStaffById(staffId)
  }

  if (!staff && matches.length === 1) {
    staff = await fetchStaffById(matches[0].id)
  }

  return {
    staff,
    matches,
    normalizedQuery,
    tokens
  }
}

export type StaffAdvancesSummary = {
  staffId: string
  staffName: string
  unitCode: string | null
  projectId: string | null
  projectName: string | null
  pendingAdvanceCount: number
  pendingAdvanceAmount: number
  pendingAdvanceIds: string[]
}

export function buildStaffAdvancesSummary(match: StaffSearchMatch | null): StaffAdvancesSummary | null {
  if (!match) {
    return null
  }

  return {
    staffId: match.id,
    staffName: match.name,
    unitCode: match.unitCode,
    projectId: match.projectId,
    projectName: match.projectName,
    pendingAdvanceCount: match.pendingAdvanceCount,
    pendingAdvanceAmount: Number(match.pendingAdvanceAmount.toFixed(2)),
    pendingAdvanceIds: match.pendingAdvanceIds
  }
}
