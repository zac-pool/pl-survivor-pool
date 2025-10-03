import { createServerClient } from '@/lib/supabase/server'

export type OddsBestRow = {
  gameweek: number
  event_id: string
  commence_time: string
  home_team: string
  away_team: string
  best_home: number | null
  best_draw: number | null
  best_away: number | null
  p_home: number | null
  p_draw: number | null
  p_away: number | null
}

export type TeamWinPctRow = {
  gameweek: number
  event_id: string
  commence_time: string
  team: string
  opponent: string
  side: 'H' | 'A'
  price_decimal: number | null
  win_pct: number | null
}

export type OddsSnapshotRow = {
  id: string
  gameweek: number
  taken_at: string
  window_start?: string | null
  window_end?: string | null
}

export async function getLatestOddsForGameweek(gameweek: number) {
  const sb = await createServerClient()
  const { data, error } = await sb
    .from('odds_latest_best')
    .select('*')
    .eq('gameweek', gameweek)
    .order('commence_time', { ascending: true })

  if (error) throw error
  return (data as OddsBestRow[]) ?? []
}

export async function getTeamWinPct(gameweek: number) {
  const sb = await createServerClient()
  const { data, error } = await sb
    .from('odds_team_win_pct_latest')
    .select('*')
    .eq('gameweek', gameweek)
    .order('win_pct', { ascending: false })

  if (error) throw error
  return (data as TeamWinPctRow[]) ?? []
}

export async function getLatestSnapshotForGameweek(gameweek: number) {
  const sb = await createServerClient()
  const { data, error } = await sb
    .from('odds_latest_snapshot')
    .select('*')
    .eq('gameweek', gameweek)
    .maybeSingle()

  if (error) throw error
  return (data as OddsSnapshotRow) ?? null
}
