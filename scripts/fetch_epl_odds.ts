/*
  Fetch EPL odds from The Odds API and persist snapshot+bookmaker odds in Supabase.
  Run via: npm run fetch:odds (requires TSX).
*/

import { createClient } from '@supabase/supabase-js'

const SPORT_KEY = 'soccer_epl'
const REGIONS = 'uk'
const MARKETS = 'h2h'
const ODDS_FORMAT = 'decimal'
const DATE_FORMAT = 'iso'
const BOOKMAKERS = ['bet365', 'paddypower', 'williamhill_uk', 'ladbrokes', 'coral', 'betfair']
const WINDOW_DAYS = 7

async function resolveGameweek(supabase: any) {
  const nowIso = new Date().toISOString()

  const { data: lastClosed } = await supabase
    .from('gameweek_deadlines')
    .select('gameweek, pick_deadline')
    .lte('pick_deadline', nowIso)
    .order('pick_deadline', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastClosed?.gameweek) {
    return lastClosed.gameweek as number
  }

  const { data: upcoming } = await supabase
    .from('gameweek_deadlines')
    .select('gameweek, pick_deadline')
    .gte('pick_deadline', nowIso)
    .order('pick_deadline', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (upcoming?.gameweek as number) ?? 1
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

type OddsApiOutcome = {
  name: string
  price: number
}

type OddsApiMarket = {
  key: string
  outcomes: OddsApiOutcome[]
}

type OddsApiBookmaker = {
  key: string
  title: string
  last_update: string
  markets: OddsApiMarket[]
}

type OddsApiEvent = {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: OddsApiBookmaker[]
}

async function main() {
  try {
    const oddsApiKey = requireEnv('ODDS_API_KEY')
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const gameweek = await resolveGameweek(supabase)

    console.log(`Fetching odds for gameweek ${gameweek}`)

    const query = new URLSearchParams({
      apiKey: oddsApiKey,
      regions: REGIONS,
      markets: MARKETS,
      oddsFormat: ODDS_FORMAT,
      dateFormat: DATE_FORMAT,
      bookmakers: BOOKMAKERS.join(','),
    })

    const requestUrl = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds?${query.toString()}`
    const response = await fetch(requestUrl)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Odds API request failed (${response.status}): ${text}`)
    }

    const events: OddsApiEvent[] = await response.json()
    console.log(`Fetched ${events.length} events from The Odds API.`)

    const now = new Date()
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const { data: snapshot, error: snapshotError } = await supabase
      .from('odds_snapshots')
      .insert({
        gameweek,
        taken_at: now.toISOString(),
        window_start: now.toISOString(),
        window_end: windowEnd.toISOString(),
      })
      .select()
      .single()

    if (snapshotError || !snapshot) {
      throw new Error(`Failed to insert odds snapshot: ${snapshotError?.message ?? 'unknown error'}`)
    }

    type InsertGameOdds = {
      snapshot_id: string
      event_id: string
      commence_time: string
      home_team: string
      away_team: string
      bookmaker: string
      last_update: string | null
      home_price_decimal: number | null
      draw_price_decimal: number | null
      away_price_decimal: number | null
      implied_home: number | null
      implied_draw: number | null
      implied_away: number | null
      margin: number | null
    }

    const rows: InsertGameOdds[] = []

    const implied = (decimal?: number) => (decimal && decimal > 1 ? 1 / decimal : null)

    for (const event of events) {
      for (const bookmaker of event.bookmakers ?? []) {
        if (!BOOKMAKERS.includes(bookmaker.key)) continue

        const h2hMarket = bookmaker.markets?.find((market) => market.key === 'h2h')
        let homePrice: number | undefined
        let awayPrice: number | undefined
        let drawPrice: number | undefined

        if (h2hMarket?.outcomes) {
          for (const outcome of h2hMarket.outcomes as Array<{ name: string; price: number }>) {
            if (outcome.name === event.home_team) homePrice = outcome.price
            else if (outcome.name === event.away_team) awayPrice = outcome.price
            else if (outcome.name.toLowerCase() === 'draw') drawPrice = outcome.price
          }
        }

        const homeImplied = implied(homePrice)
        const drawImplied = implied(drawPrice)
        const awayImplied = implied(awayPrice)
        const marginRaw = (homeImplied ?? 0) + (drawImplied ?? 0) + (awayImplied ?? 0) - 1
        const margin = Number.isFinite(marginRaw) ? marginRaw : null

        rows.push({
          snapshot_id: snapshot.id,
          event_id: event.id,
          commence_time: event.commence_time,
          home_team: event.home_team,
          away_team: event.away_team,
          bookmaker: bookmaker.key,
          last_update: (bookmaker.last_update as string) ?? null,
          home_price_decimal: homePrice ?? null,
          draw_price_decimal: drawPrice ?? null,
          away_price_decimal: awayPrice ?? null,
          implied_home: homeImplied,
          implied_draw: drawImplied,
          implied_away: awayImplied,
          margin,
        })
      }
    }

    if (rows.length === 0) {
      console.warn('No odds rows parsed; skipping insert.')
      process.exit(0)
    }

    console.log('[debug] insert keys:', Object.keys(rows[0]))

    const sanitized = rows.map((row) => ({
      snapshot_id: row.snapshot_id,
      event_id: row.event_id,
      commence_time: row.commence_time,
      home_team: row.home_team,
      away_team: row.away_team,
      bookmaker: row.bookmaker,
      last_update: row.last_update,
      home_price_decimal: row.home_price_decimal,
      draw_price_decimal: row.draw_price_decimal,
      away_price_decimal: row.away_price_decimal,
      implied_home: row.implied_home,
      implied_draw: row.implied_draw,
      implied_away: row.implied_away,
      margin: row.margin,
    }))


    const { error: oddsError } = await supabase.from('game_odds').upsert(sanitized, { onConflict: 'snapshot_id,event_id,bookmaker' })

    if (oddsError) {
      console.error('[debug] first row sent:', sanitized[0])
      throw new Error(`Failed to insert game odds: ${oddsError.message}`)
    }

    console.log(`Inserted snapshot ${snapshot.id} and ${sanitized.length} odds rows.`)
    const remaining = response.headers.get('x-requests-remaining')
    const used = response.headers.get('x-requests-used')
    const cost = response.headers.get('x-requests-last')
    console.log('Odds API usage:', { remaining, used, cost })
    process.exit(0)
  } catch (error) {
    console.error('[fetch_epl_odds] Fatal error:', error)
    process.exit(1)
  }
}

void main()
