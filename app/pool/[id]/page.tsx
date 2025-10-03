import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import QuickPickCard from './quick-pick-card'
import ShareButton from './share-button'
import ManageMembersDialog from './manage-members-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGameweekContext } from '@/lib/gameweeks'
import { getTeamWinPct, type TeamWinPctRow } from '@/lib/odds'
import { WinPercentList } from '@/components/dashboard/WinPercentList'

type PoolMemberSummary = {
  userId: string
  name: string
  status: 'ALIVE' | 'ELIMINATED' | 'UNKNOWN'
  livesRemaining: number
  roundsSurvived: number
  teamsUsed: string[]
  teamsAvailableCount: number
}

type GameweekResult = 'WIN' | 'LOSS' | 'PENDING'

type PoolPickSummary = {
  player: string
  team: string | null
  result: GameweekResult
}

type WeeklyPoolPicks = {
  gameweek: number
  picks: PoolPickSummary[]
}

type PoolRow = {
  id: number | string
  name: string
  code: string | null
  lives_per_player: number | null
  created_by?: string
  entry_fee?: number | null
  prize_pool?: number | null
  season_label?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  ALIVE: 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/30',
  ELIMINATED: 'text-rose-500 bg-rose-500/10 border border-rose-500/30',
  UNKNOWN: 'text-slate-500 bg-slate-500/10 border border-slate-500/20',
}

function displayTeamName(name: string | null | undefined) {
  if (!name) return name ?? ''
  const replacements: Record<string, string> = {
    'Wolverhampton Wanderers': 'Wolves',
  }
  return replacements[name] ?? name
}

function renderLivesDisplay(current: number, total: number | null) {
  const hearts = total != null ? total : current
  const effectiveTotal = hearts > 0 ? hearts : 1
  return Array.from({ length: effectiveTotal }, (_, index) => {
    const isActive = index < current
    return (
      <span
        key={index}
        aria-hidden="true"
        className={isActive ? 'text-rose-500' : 'text-rose-200'}
      >
        {isActive ? '❤' : '♡'}
      </span>
    )
  })
}

function formatKickoff(dateUtc: string) {
  try {
    return format(new Date(dateUtc), 'EEE d MMM • HH:mm')
  } catch (error) {
    return dateUtc
  }
}

function formatDeadlineCountdown(dateUtc: string) {
  const diffMs = new Date(dateUtc).getTime() - Date.now()
  if (diffMs <= 0) return 'Deadline passed'
  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return `${days}d ${hours}h ${minutes}m`
}

function normalizeMemberStatus(status: string | null): PoolMemberSummary['status'] {
  if (!status) return 'UNKNOWN'
  const value = status.toLowerCase()
  if (value === 'alive' || value === 'active') return 'ALIVE'
  if (value === 'eliminated' || value === 'out') return 'ELIMINATED'
  return 'UNKNOWN'
}

function mapPickResult(status: string | null): GameweekResult {
  if (!status) return 'PENDING'
  const value = status.toLowerCase()
  if (value === 'win' || value === 'won') return 'WIN'
  if (value === 'loss' || value === 'lost') return 'LOSS'
  return 'PENDING'
}

function buildSeasonLabel(firstKickoffIso: string | null | undefined, fallback = 'Premier League Survivor') {
  if (!firstKickoffIso) return fallback
  const kickoff = new Date(firstKickoffIso)
  if (Number.isNaN(kickoff.getTime())) return fallback
  const startYear = kickoff.getUTCFullYear()
  const nextYear = startYear + 1
  return `${startYear}/${String(nextYear).slice(-2)} Premier League`
}

function formatCurrency(amount: number | null | undefined) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function derivePickResult(row: { status?: string | null; result?: string | null } | null | undefined): GameweekResult {
  if (!row) return 'PENDING'
  const raw = row.result ?? row.status ?? null
  return mapPickResult(typeof raw === 'string' ? raw : null)
}

export default async function PoolPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('PoolPage: unable to fetch auth user', authError)
  }

  if (!user) {
    redirect('/login')
  }

  const poolId = params.id

  const { upcoming, lastClosed } = await getGameweekContext()
  const pickWeekRow = upcoming ?? lastClosed
  const pickGameweek = pickWeekRow?.gameweek ?? 1
  const oddsGameweek = pickGameweek

  let winPercentRows: TeamWinPctRow[] = []
  try {
    winPercentRows = await getTeamWinPct(oddsGameweek)
  } catch (error) {
    console.error('PoolPage: failed to load win % data', error)
  }

  const weekStartMs = pickWeekRow?.first_kickoff ? Date.parse(pickWeekRow.first_kickoff) : null
  const weekEndMs = weekStartMs != null ? weekStartMs + 7 * 24 * 60 * 60 * 1000 : null

  winPercentRows = winPercentRows
    .filter((row) => {
      const time = Date.parse(row.commence_time)
      if (!Number.isFinite(time)) return true
      if (weekStartMs != null && time < weekStartMs) return false
      if (weekEndMs != null && time >= weekEndMs) return false
      return true
    })
    .map((row) => ({
      ...row,
      team: displayTeamName(row.team),
      opponent: displayTeamName(row.opponent),
    }))

  winPercentRows.sort((a, b) => (b.win_pct ?? 0) - (a.win_pct ?? 0))

  const { data: membershipRow, error: membershipError } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('PoolPage: membership lookup failed', membershipError)
  }

  if (!membershipRow) {
    redirect('/dashboard')
  }

  const { data: poolRowRaw, error: poolError } = await supabase
    .from('pools')
    .select('id, name, code, lives_per_player, created_by')
    .eq('id', poolId)
    .maybeSingle()

  if (poolError) {
    console.error('PoolPage: failed to load pool', poolError)
  }

  const poolRow = (poolRowRaw ?? null) as PoolRow | null

  if (!poolRow) {
    redirect('/dashboard')
  }

  const livesPerPlayer = poolRow.lives_per_player ?? null

  const { data: teamRows, error: teamsError } = await adminSupabase
    .from('teams')
    .select('id, name')
    .order('name')

  if (teamsError) {
    console.error('PoolPage: failed to load teams', teamsError)
  }

  const { data: allPickRows, error: picksError } = await adminSupabase
    .from('picks')
    .select('id, user_id, team_id, gameweek, created_at')
    .eq('pool_id', poolId)

  if (picksError) {
    console.error('PoolPage: failed to load picks', picksError)
  }

  const { data: memberRows, error: membersError } = await adminSupabase
    .from('pool_members')
    .select('id, user_id, status, lives_remaining, joined_at')
    .eq('pool_id', poolId)

  if (membersError) {
    console.error('PoolPage: failed to load pool members', membersError)
  }

  const userIds = new Set<string>()
  memberRows?.forEach((row) => {
    if (row.user_id) userIds.add(row.user_id)
  })

  const profilesResult = userIds.size > 0
    ? await supabase
        .from('profiles')
        .select('id, username')
        .in('id', Array.from(userIds))
    : { data: [], error: null }

  if (profilesResult.error) {
    console.error('PoolPage: failed to load profile names', profilesResult.error)
  }

  const profileNameMap = new Map<string, string>()
  profilesResult.data?.forEach((profile: { id: string; username: string | null }) => {
    profileNameMap.set(profile.id, profile.username || 'Player')
  })

  const teamNameMap = new Map<number, string>()
  teamRows?.forEach((team) => {
    if (typeof team.id === 'number') {
      teamNameMap.set(team.id, displayTeamName(team.name))
    }
  })

  const memberDetails = (memberRows ?? []).flatMap((member) => {
    const membershipIdRaw = typeof member.id === 'number' ? member.id : Number(member.id)
    if (!Number.isFinite(membershipIdRaw)) return []

    return [
      {
        membershipId: membershipIdRaw,
        userId: member.user_id,
        rawStatus: member.status ?? null,
        livesRemaining: member.lives_remaining ?? 0,
        name: profileNameMap.get(member.user_id) ?? 'Player',
        joinedAt: member.joined_at ?? null,
      },
    ]
  })

  const totalTeams = teamRows?.length ?? 0
  const picksByUser = new Map<string, typeof allPickRows>()
  allPickRows?.forEach((pick) => {
    if (!pick.user_id) return
    const list = picksByUser.get(pick.user_id) ?? []
    list.push(pick)
    picksByUser.set(pick.user_id, list)
  })

  const userPickRows = picksByUser.get(user.id) ?? []
  let currentPickTeamId: number | null = null
  let currentPickStatus: GameweekResult | null = null
  const usedTeamIds = new Set<number>()

  userPickRows.forEach((row) => {
    if (typeof row.gameweek !== 'number') return
    const pickResult = derivePickResult(row as any)
    if (row.gameweek === pickGameweek) {
      currentPickTeamId = typeof row.team_id === 'number' ? row.team_id : null
      currentPickStatus = pickResult
    } else if (typeof row.team_id === 'number') {
      usedTeamIds.add(row.team_id)
    }
  })

  const teams = (teamRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    used: usedTeamIds.has(row.id),
  }))

  const currentPickTeamName = typeof currentPickTeamId === 'number'
    ? teamNameMap.get(currentPickTeamId) ?? null
    : null

  const memberSummaries: PoolMemberSummary[] = memberDetails.map((member) => {
    const memberPicks = picksByUser.get(member.userId) ?? []
    const uniqueTeamIds = Array.from(
      new Set(
        memberPicks
          .map((pick) => (typeof pick.team_id === 'number' ? pick.team_id : null))
          .filter((teamId): teamId is number => teamId !== null)
      )
    )
    const teamsUsedNames = uniqueTeamIds.map((teamId) => teamNameMap.get(teamId) ?? `Team ${teamId}`)
    const roundsSurvived = memberPicks.filter((pick) => derivePickResult(pick as any) === 'WIN').length
    const teamsAvailableCount = totalTeams > 0 ? Math.max(totalTeams - uniqueTeamIds.length, 0) : 0

    return {
      userId: member.userId,
      name: member.name,
      status: normalizeMemberStatus(member.rawStatus),
      livesRemaining: member.livesRemaining,
      roundsSurvived,
      teamsUsed: teamsUsedNames,
      teamsAvailableCount,
    }
  })

  const currentMemberSummary = memberSummaries.find((member) => member.userId === user.id)
    ?? {
      userId: user.id,
      name: profileNameMap.get(user.id) ?? 'You',
      status: 'UNKNOWN' as const,
      livesRemaining: 0,
      roundsSurvived: 0,
      teamsUsed: [],
      teamsAvailableCount: totalTeams,
    }

  const livesDisplay = livesPerPlayer != null
    ? `${currentMemberSummary.livesRemaining}/${livesPerPlayer}`
    : String(currentMemberSummary.livesRemaining)

  const manageMembersList = memberDetails
    .map((member) => ({
      membershipId: member.membershipId,
      userId: member.userId,
      name: member.name,
      isOwnerMember: member.userId === poolRow.created_by,
      isCurrentUser: member.userId === user.id,
      status: member.rawStatus,
      livesRemaining: member.livesRemaining,
    }))
    .sort((a, b) => {
      if (a.isOwnerMember && !b.isOwnerMember) return -1
      if (!a.isOwnerMember && b.isOwnerMember) return 1
      if (a.isCurrentUser && !b.isCurrentUser) return -1
      if (!a.isCurrentUser && b.isCurrentUser) return 1
      return a.name.localeCompare(b.name)
    })

  const isOwner = user.id === poolRow.created_by

  const sortedLeaderboard = [...memberSummaries].sort((a, b) => {
    if (a.status === b.status) {
      return b.livesRemaining - a.livesRemaining
    }
    if (a.status === 'ALIVE') return -1
    if (b.status === 'ALIVE') return 1
    return a.status.localeCompare(b.status)
  })

  const picksByGameweek = new Map<number, typeof allPickRows>()
  allPickRows?.forEach((pick) => {
    if (typeof pick.gameweek !== 'number') return
    if (!picksByGameweek.has(pick.gameweek)) {
      picksByGameweek.set(pick.gameweek, [])
    }
    picksByGameweek.get(pick.gameweek)!.push(pick)
  })

  const sortedGameweeks = Array.from(picksByGameweek.keys()).sort((a, b) => a - b)
  const weeklyPicks = sortedGameweeks.map<WeeklyPoolPicks>((gameweek) => {
    const picks = picksByGameweek.get(gameweek) ?? []
    return {
      gameweek,
      picks: picks.map((pick) => ({
        player: profileNameMap.get(pick.user_id) ?? 'Player',
        team: typeof pick.team_id === 'number' ? teamNameMap.get(pick.team_id) ?? null : null,
        result: derivePickResult(pick as any),
      })),
    }
  })

  const closedGameweek = lastClosed?.gameweek ?? null
  const completedWeeklyPicks = closedGameweek != null
    ? weeklyPicks.filter((week) => week.gameweek <= closedGameweek)
    : weeklyPicks

  const latestWeeklyPicks = completedWeeklyPicks.slice(-3).reverse()

  const recentWinners = completedWeeklyPicks.reduce<Record<number, string[]>>((acc, week) => {
    const winners = new Set<string>()
    week.picks.forEach((pick) => {
      if (pick.result === 'WIN' && pick.team) {
        winners.add(pick.team)
      }
    })
    acc[week.gameweek] = Array.from(winners)
    return acc
  }, {})

  const deadlineCountdown = pickWeekRow?.pick_deadline
    ? formatDeadlineCountdown(pickWeekRow.pick_deadline)
    : 'Deadline passed'

  const deadlineDate = pickWeekRow?.pick_deadline ? new Date(pickWeekRow.pick_deadline) : null
  const deadlineDisplay = deadlineDate ? format(deadlineDate, 'EEE d MMM • HH:mm') : null
  const gameweekLabel = pickWeekRow?.gameweek ?? pickGameweek
  const seasonLabel = (poolRow as Partial<PoolRow> & { season_label?: string | null }).season_label
    ?? buildSeasonLabel(pickWeekRow?.first_kickoff)
  const entryFeeNumber = (poolRow as Partial<PoolRow> & { entry_fee?: number | null }).entry_fee ?? null
  const prizePotNumber = (poolRow as Partial<PoolRow> & { prize_pool?: number | null }).prize_pool ?? (
    typeof entryFeeNumber === 'number' ? entryFeeNumber * memberSummaries.length : null
  )
  const entryFeeLabel = formatCurrency(entryFeeNumber)
  const prizePotLabel = formatCurrency(prizePotNumber)
  const teamsUsedNames = currentMemberSummary.teamsUsed
  const currentTeamsDisplay = teamsUsedNames.slice(0, 12)
  const currentTeamsRemaining = teamsUsedNames.length - currentTeamsDisplay.length
  const membersCount = memberSummaries.length
  const latestGameweekNumbers = latestWeeklyPicks.map((item) => item.gameweek)
  const weeklyRangeLabel = latestGameweekNumbers.length > 0
    ? `${Math.min(...latestGameweekNumbers)} - ${Math.max(...latestGameweekNumbers)}`
    : '—'
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f2ff] via-white to-[#f4f4ff]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        {deadlineDisplay ? (
          <div className="-mx-4 -mt-12 bg-purple-600 px-4 py-2 text-xs font-medium text-white sm:-mx-6 sm:text-sm lg:-mx-8">
            {`Gameweek ${gameweekLabel} • Deadline: ${deadlineDisplay}`}
          </div>
        ) : null}
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-purple-100 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-purple-700">
              {seasonLabel}
            </span>
            <div>
              <h1 className="text-4xl font-semibold text-[#1f0a33] md:text-5xl">
                {poolRow.name}
              </h1>
              <p className="text-sm text-[#655979]">
                Gameweek {gameweekLabel} • Entry {entryFeeLabel} • Prize pot {prizePotLabel}
              </p>
            </div>
          </div>
          <div className="hidden w-full flex-col gap-3 sm:flex sm:w-auto sm:flex-row sm:flex-wrap">
            <ShareButton poolId={poolId} className="w-full sm:w-auto" />
            {isOwner ? (
              <ManageMembersDialog poolId={poolId} members={manageMembersList} canManage={isOwner} />
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="order-1 col-span-12 md:col-span-8">
            <QuickPickCard
              poolId={poolId}
              currentGameweek={pickGameweek}
              deadlineCountdown={deadlineCountdown}
              currentPick={{ teamId: currentPickTeamId, teamName: currentPickTeamName, status: currentPickStatus }}
              teams={teams}
              teamsUsedNames={teamsUsedNames}
              className="h-full"
            />
          </div>

          <Card className="order-2 col-span-12 rounded-[28px] border-0 bg-gradient-to-br from-[#4b0b6c] via-[#38003c] to-[#220021] text-white shadow-xl shadow-[#38003c]/40 md:col-span-4">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-[0.2em] text-white/70">
                  Your Status
                </CardTitle>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                  {currentMemberSummary.status}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-semibold">{livesDisplay}</p>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="flex gap-1 text-base">
                    {renderLivesDisplay(currentMemberSummary.livesRemaining, livesPerPlayer)}
                  </span>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/60">Lives Remaining</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-white/80">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[20px] bg-white/10 p-4">
                  <p className="text-2xl font-semibold text-white">{currentMemberSummary.roundsSurvived}</p>
                  <p className="text-xs uppercase tracking-widest text-white/60">Rounds Survived</p>
                </div>
                <div className="rounded-[20px] bg-white/10 p-4">
                  <p className="text-2xl font-semibold text-white">{currentMemberSummary.teamsAvailableCount}</p>
                  <p className="text-xs uppercase tracking-widest text-white/60">Teams Available</p>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.4em] text-white/60">Teams Used</p>
                {currentTeamsDisplay.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentTeamsDisplay.map((team) => (
                      <span key={team} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                        {team}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/60">No teams locked yet.</p>
                )}
                {currentTeamsRemaining > 0 ? (
                  <p className="mt-2 text-[11px] uppercase tracking-widest text-white/50">
                    +{currentTeamsRemaining} more
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:hidden">
                <ShareButton poolId={poolId} className="w-full" />
                {isOwner ? (
                  <ManageMembersDialog
                    poolId={poolId}
                    members={manageMembersList}
                    canManage={isOwner}
                    triggerVariant="primary"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="order-3 col-span-12">
            <WinPercentList rows={winPercentRows} gameweek={oddsGameweek} />
          </div>

          <Card className="order-4 col-span-12 rounded-[28px] border border-white/60 bg-white/80 shadow-lg shadow-purple-100 md:col-span-8 md:row-span-2">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-[0.3em] text-[#73608f]">
                Recent Picks & Results
              </CardTitle>
              <span className="text-xs font-semibold text-[#38003c]">
                Gameweeks {weeklyRangeLabel}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestWeeklyPicks.map((weekly) => (
                <div key={weekly.gameweek} className="rounded-[22px] border border-[#ede7ff] bg-white/70 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-[#9983bc]">Gameweek {weekly.gameweek}</p>
                      <p className="text-lg font-semibold text-[#2c1147]">
                        {recentWinners[weekly.gameweek]?.join(', ') ?? 'Pending results'}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#f6f2ff] px-3 py-1 text-xs font-semibold text-[#5d3b92]">Winners</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {weekly.picks.map((pick) => (
                      <div
                        key={`${weekly.gameweek}-${pick.player}`}
                        className="flex items-center justify-between rounded-[18px] border border-[#f2ecff] bg-white px-4 py-3 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#311048]">{pick.player}</p>
                          <p className="text-xs text-[#7a699a]">{pick.team ?? 'No pick made'}</p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            pick.result === 'WIN'
                              ? 'bg-emerald-100 text-emerald-600'
                              : pick.result === 'LOSS'
                              ? 'bg-rose-100 text-rose-600'
                              : 'bg-amber-100 text-amber-600'
                          }`}
                        >
                          {pick.result === 'WIN'
                            ? 'Survived'
                            : pick.result === 'LOSS'
                            ? 'Life lost'
                            : 'Result pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="order-5 col-span-12 rounded-[28px] border border-white/40 bg-white/80 shadow-lg shadow-purple-100 md:col-span-4 md:row-span-3">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-[0.3em] text-[#73608f]">
                Pool Standings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedLeaderboard.map((member, index) => (
                <div
                  key={member.userId}
                  className={`flex items-center justify-between rounded-[20px] border bg-white px-4 py-3 shadow-sm ${
                    member.userId === currentMemberSummary.userId ? 'border-[#c9b0ff] bg-[#f8f5ff]' : 'border-[#f1eafd]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f1eafd] text-sm font-semibold text-[#3f1a68] ${index < 3 ? 'bg-[#38003c] text-white' : ''}`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#2c1147]">
                        {member.name}
                        {member.userId === currentMemberSummary.userId && (
                          <span className="ml-2 text-xs font-medium text-[#7a699a]">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-[#7a699a]">
                        {member.livesRemaining} {member.livesRemaining === 1 ? 'life' : 'lives'}
                        {livesPerPlayer != null ? ` of ${livesPerPlayer}` : ''} • {member.roundsSurvived} rounds
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      STATUS_COLORS[member.status] ?? STATUS_COLORS.UNKNOWN
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="order-6 col-span-12 rounded-[28px] border border-white/40 bg-gradient-to-br from-[#00ffbf] via-[#58f1ff] to-[#c6f6ff] text-[#023b2c] shadow-xl shadow-cyan-200/40 md:col-span-4">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-[0.3em] text-[#035640]">
                Potential Winnings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-4xl font-semibold">{prizePotLabel}</p>
              <p className="text-sm text-[#065d48]">Current pot based on {membersCount} players</p>
              <div className="rounded-[20px] bg-white/40 p-4 text-xs text-[#0a4a39]">
                Break-even at {entryFeeLabel} per player • Adds up with every elimination
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
