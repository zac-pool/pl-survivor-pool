import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2?dts'

const SPORT_KEY = 'soccer_epl'
const REGIONS = 'uk'
const MARKETS = 'h2h'
const ODDS_FORMAT = 'decimal'
const DATE_FORMAT = 'iso'
const BOOKMAKERS = ['bet365', 'paddypower', 'williamhill_uk', 'ladbrokes', 'coral', 'betfair']
const WINDOW_DAYS = 7
const FALLBACK_GAMEWEEK = Number(Deno.env.get('DEFAULT_GAMEWEEK') ?? 7)

function requireEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }
  return value
}

function implied(decimal?: number | null) {
  if (!decimal || decimal <= 1) return null
  return 1 / decimal
}

export default async function handler(req: Request) {
  try {
    const oddsApiKey = requireEnv('ODDS_API_KEY')
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const url = new URL(req.url)
    const gwParam = url.searchParams.get('gameweek')
    const gameweek = gwParam ? Number(gwParam) : FALLBACK_GAMEWEEK

    if (!Number.isFinite(gameweek)) {
      return new Response(JSON.stringify({ error: 'Invalid gameweek parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const query = new URLSearchParams({
      apiKey: oddsApiKey,
      regions: REGIONS,
      markets: MARKETS,
      oddsFormat: ODDS_FORMAT,
      dateFormat: DATE_FORMAT,
      bookmakers: BOOKMAKERS.join(','),
    })

    const requestUrl = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds?${query.toString()}`
    const oddsResponse = await fetch(requestUrl)

    if (!oddsResponse.ok) {
      const text = await oddsResponse.text()
      console.error('fetch-odds: API error', oddsResponse.status, text)
      return new Response(
        JSON.stringify({ error: 'Odds API request failed', status: oddsResponse.status, body: text }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const events = (await oddsResponse.json()) as Array<{
      id: string
      commence_time: string
      home_team: string
      away_team: string
      bookmakers?: Array<{ key: string; last_update?: string; markets?: Array<{ key: string; outcomes?: Array<{ name: string; price: number }> }> }>
    }>

    if (!Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, events: 0, rows: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const windowStart = now.toISOString()
    const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: snapshot, error: snapshotError } = await supabase
      .from('odds_snapshots')
      .insert({
        gameweek,
        taken_at: now.toISOString(),
        window_start: windowStart,
        window_end: windowEnd,
      })
      .select()
      .single()

    if (snapshotError || !snapshot) {
      console.error('fetch-odds: failed to insert snapshot', snapshotError)
      return new Response(JSON.stringify({ error: 'Unable to insert snapshot', details: snapshotError?.message ?? null }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const rows = [] as Array<{ [key: string]: string | number | null }>

    for (const event of events) {
      for (const bookmaker of event.bookmakers ?? []) {
        if (!BOOKMAKERS.includes(bookmaker.key)) continue

        const market = bookmaker.markets?.find((m) => m.key === 'h2h')
        if (!market || !market.outcomes) continue

        let homePrice: number | undefined
        let drawPrice: number | undefined
        let awayPrice: number | undefined

        for (const outcome of market.outcomes) {
          if (outcome.name === event.home_team) homePrice = outcome.price
          else if (outcome.name === event.away_team) awayPrice = outcome.price
          else if (outcome.name.toLowerCase() === 'draw') drawPrice = outcome.price
        }

        const homeImplied = implied(homePrice)
        const drawImplied = implied(drawPrice)
        const awayImplied = implied(awayPrice)
        const margin = (homeImplied ?? 0) + (drawImplied ?? 0) + (awayImplied ?? 0)

        rows.push({
          snapshot_id: snapshot.id,
          event_id: event.id,
          commence_time: event.commence_time,
          home_team: event.home_team,
          away_team: event.away_team,
          bookmaker: bookmaker.key,
          last_update: bookmaker.last_update ?? null,
          home_price_decimal: homePrice ?? null,
          draw_price_decimal: drawPrice ?? null,
          away_price_decimal: awayPrice ?? null,
          implied_home: homeImplied,
          implied_draw: drawImplied,
          implied_away: awayImplied,
          margin: Number.isFinite(margin) ? margin : null,
        })
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, snapshot: snapshot.id, events: events.length, rows: 0, note: 'No bookmaker rows parsed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { error: upsertError } = await supabase
      .from('game_odds')
      .upsert(rows, { onConflict: 'snapshot_id,event_id,bookmaker' })

    if (upsertError) {
      console.error('fetch-odds: failed to upsert rows', upsertError)
      return new Response(JSON.stringify({ error: 'Unable to insert odds rows', details: upsertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const remaining = oddsResponse.headers.get('x-requests-remaining')
    const used = oddsResponse.headers.get('x-requests-used')
    const cost = oddsResponse.headers.get('x-requests-last')

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot: snapshot.id,
        events: events.length,
        rows: rows.length,
        usage: { remaining, used, cost },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('fetch-odds: fatal error', error)
    return new Response(JSON.stringify({ error: 'Unexpected error', details: `${error}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
