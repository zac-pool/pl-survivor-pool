import { createServerClient } from '@/lib/supabase/server'

export type GameweekDeadline = {
  gameweek: number
  first_kickoff: string
  pick_deadline: string
  odds_refresh_at: string
}

export async function getGameweekContext(now: Date = new Date()) {
  const sb = await createServerClient()
  const nowIso = now.toISOString()

  const { data: upcomingData } = await sb
    .from('gameweek_deadlines')
    .select('*')
    .gte('pick_deadline', nowIso)
    .order('pick_deadline', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: lastClosedData } = await sb
    .from('gameweek_deadlines')
    .select('*')
    .lte('pick_deadline', nowIso)
    .order('pick_deadline', { ascending: false })
    .limit(1)
    .maybeSingle()

  const upcoming = (upcomingData as GameweekDeadline | null) ?? null
  const lastClosed = (lastClosedData as GameweekDeadline | null) ?? null

  return { upcoming, lastClosed }
}

export async function getPickGameweek(now: Date = new Date()) {
  const { upcoming, lastClosed } = await getGameweekContext(now)
  return upcoming ?? lastClosed ?? null
}

export async function getOddsGameweek(now: Date = new Date()) {
  const { upcoming, lastClosed } = await getGameweekContext(now)
  return lastClosed ?? upcoming ?? null
}
