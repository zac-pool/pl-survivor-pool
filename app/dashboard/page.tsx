import { redirect } from 'next/navigation'
import DashboardClient, { type DashboardPoolMembership } from './dashboard-client'
import { createServerClient } from '@/lib/supabase/server'
import { getLatestSnapshotForGameweek, getLatestOddsForGameweek, type OddsBestRow, type OddsSnapshotRow } from '@/lib/odds'
import { normalizePoolRole } from '@/lib/pools'
import { getGameweekContext } from '@/lib/gameweeks'

type PoolMemberRow = {
  id: string
  pool_id: string
  status: string | null
  lives_remaining: number | null
}

type PoolRecord = {
  id: string
  name: string
  code: string | null
  lives_per_player: number | null
}

type PoolMemberCountRow = {
  pool_id: string
}

type DashboardPageProps = {
  searchParams?: {
    pool?: string
  }
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('DashboardPage: unable to fetch auth user', authError)
  }

  if (!user) {
    redirect('/login')
  }

  const { upcoming, lastClosed } = await getGameweekContext()
  const pickWeekRow = upcoming ?? lastClosed
  const oddsWeekRow = lastClosed ?? upcoming
  const pickGameweek = pickWeekRow?.gameweek ?? 1
  const oddsGameweek = oddsWeekRow?.gameweek ?? pickGameweek

  const { data, error } = await supabase
    .from('pool_members')
    .select(
      `
        id,
        pool_id,
        status,
        lives_remaining
      `
    )
    .eq('user_id', user.id)

  const rawMemberships = (data ?? []) as Record<string, any>[]
  const membershipRows: PoolMemberRow[] = rawMemberships.map((row) => ({
    id: String(row.id),
    pool_id: String(row.pool_id),
    status: row.status,
    lives_remaining: row.lives_remaining,
  }))

  const poolIds = Array.from(new Set(membershipRows.map((membership) => membership.pool_id))).filter(Boolean)
  const poolIdList = poolIds.length > 0 ? poolIds : []

  let memberCounts: Record<string, number> = {}
  let poolsMap: Map<string, PoolRecord> = new Map()
  const currentPickMap = new Map<string, { teamName: string | null; status: string | null }>()

  if (poolIdList.length > 0) {
    const { data: currentWeekPicks } = await supabase
      .from('picks')
      .select('pool_id, team_id')
      .eq('user_id', user.id)
      .eq('gameweek', pickGameweek)
      .in('pool_id', poolIdList)

    const teamIds = new Set<number>()
    currentWeekPicks?.forEach((row) => {
      if (typeof row.team_id === 'number') {
        teamIds.add(row.team_id)
      }
    })

    let teamNameMap = new Map<number, string>()
    if (teamIds.size > 0) {
      const { data: teamRows } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', Array.from(teamIds))

      if (teamRows) {
        teamNameMap = new Map(teamRows.map((team) => [team.id, team.name]))
      }
    }

    currentWeekPicks?.forEach((row) => {
      const key = String(row.pool_id)
      currentPickMap.set(key, {
        teamName: typeof row.team_id === 'number' ? teamNameMap.get(row.team_id) ?? null : null,
        status: null,
      })
    })

    const { data: membersData } = await supabase
      .from('pool_members')
      .select('pool_id')
      .in('pool_id', poolIdList)

    if (membersData) {
      const typedMembersData = membersData as PoolMemberCountRow[]
      memberCounts = typedMembersData.reduce<Record<string, number>>((acc, row) => {
        if (!row.pool_id) return acc
        acc[row.pool_id] = (acc[row.pool_id] ?? 0) + 1
        return acc
      }, {})
    }

    const { data: poolsData, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, code, lives_per_player')
      .in('id', poolIdList)

    if (poolsData) {
      poolsMap = new Map(
        (poolsData as PoolRecord[]).map((pool) => {
          const id = String(pool.id)
          return [id, {
            id,
            name: pool.name,
            code: pool.code ?? null,
            lives_per_player: pool.lives_per_player ?? null,
          }]
        })
      )
    } else if (poolsError) {
      console.error('DashboardPage: pools lookup failed', {
        message: poolsError.message,
        details: poolsError.details,
        hint: poolsError.hint,
      })
    }
  }

  const pools: DashboardPoolMembership[] = membershipRows.map((membership) => {
    const pick = currentPickMap.get(membership.pool_id) ?? { teamName: null, status: null }

    return {
      membershipId: membership.id,
      poolId: membership.pool_id,
      role: normalizePoolRole(null),
      status: membership.status,
      livesRemaining: membership.lives_remaining,
      membersCount: memberCounts[membership.pool_id] ?? null,
      currentPickTeam: pick.teamName,
      currentPickStatus: pick.status,
      pool: poolsMap.get(membership.pool_id) ?? {
        id: membership.pool_id,
        name: `Pool ${membership.pool_id}`,
        code: null,
        lives_per_player: null,
      },
    }
  })
  let oddsRows: OddsBestRow[] = []
  let snapshot: OddsSnapshotRow | null = null

  try {
    const [oddsData, snapshotData] = await Promise.all([
      getLatestOddsForGameweek(oddsGameweek),
      getLatestSnapshotForGameweek(oddsGameweek),
    ])
    oddsRows = oddsData
    snapshot = snapshotData
  } catch (oddsError) {
    console.error('DashboardPage: failed to load odds data', oddsError)
  }

  let deadlineMs: number | null = null
  let refreshMs: number | null = null

  if (pickWeekRow?.pick_deadline) {
    const value = Date.parse(pickWeekRow.pick_deadline)
    if (Number.isFinite(value)) deadlineMs = value
  }
  if (pickWeekRow?.odds_refresh_at) {
    const value = Date.parse(pickWeekRow.odds_refresh_at)
    if (Number.isFinite(value)) refreshMs = value
  }

  if (deadlineMs == null || refreshMs == null) {
    let earliestCommenceMs: number | null = null
    for (const row of oddsRows) {
      const time = new Date(row.commence_time).getTime()
      if (!Number.isFinite(time)) continue
      if (earliestCommenceMs === null || time < earliestCommenceMs) {
        earliestCommenceMs = time
      }
    }
    if (earliestCommenceMs != null) {
      if (deadlineMs == null) deadlineMs = earliestCommenceMs - 60 * 60 * 1000
      if (refreshMs == null) refreshMs = earliestCommenceMs + 60 * 60 * 1000
    }
  }

  const snapshotTakenMs = snapshot?.taken_at ? Date.parse(snapshot.taken_at) : null
  const nowMs = Date.now()

  const isUpdating = Boolean(
    deadlineMs != null &&
      refreshMs != null &&
      nowMs >= deadlineMs &&
      nowMs < refreshMs &&
      (snapshotTakenMs == null || snapshotTakenMs < deadlineMs)
  )

  const oddsStatus = {
    isUpdating,
    deadline: deadlineMs != null ? new Date(deadlineMs).toISOString() : null,
    refreshAt: refreshMs != null ? new Date(refreshMs).toISOString() : null,
    snapshotTakenAt: snapshot?.taken_at ?? null,
  }

  const fetchError = error ? 'Unable to load your pools right now. Please try again.' : undefined

  const activePoolId = searchParams?.pool ?? null

  return (
    <DashboardClient
      pools={pools}
      fetchError={fetchError}
      activePoolId={activePoolId}
      oddsStatus={oddsStatus}
    />
  )
}
