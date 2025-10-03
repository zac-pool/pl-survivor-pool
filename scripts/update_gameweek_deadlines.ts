/*
  Fetches EPL fixtures JSON and upserts gameweek deadlines into Supabase.
  Usage: npm run update:deadlines (after adding the script to package.json).
*/

import { createClient } from '@supabase/supabase-js'

const FIXTURE_URL = 'https://fixturedownload.com/feed/json/epl-2025'
const OFFSET_MS = 60 * 60 * 1000 // 1 hour

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function toIso(dateUtc: string) {
  const ms = Date.parse(dateUtc)
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid DateUtc value: ${dateUtc}`)
  }
  return new Date(ms).toISOString()
}

async function main() {
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const response = await fetch(FIXTURE_URL)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Fixture API failed (${response.status}): ${text}`)
    }

    const fixtures = (await response.json()) as Array<{
      RoundNumber: number
      DateUtc: string
    }>

    const byRound = new Map<number, string>()

    for (const fixture of fixtures) {
      if (!fixture?.RoundNumber || !fixture?.DateUtc) continue
      const kickoffIso = toIso(fixture.DateUtc)
      const kickoffMs = Date.parse(kickoffIso)
      const stored = byRound.get(fixture.RoundNumber)
      const storedMs = stored ? Date.parse(stored) : null
      if (!stored || (Number.isFinite(kickoffMs) && (storedMs == null || kickoffMs < storedMs))) {
        byRound.set(fixture.RoundNumber, kickoffIso)
      }
    }

    const rows = Array.from(byRound.entries())
      .map(([gameweek, kickoffIso]) => {
        const kickoffMs = Date.parse(kickoffIso)
        const pickDeadlineIso = new Date(kickoffMs - OFFSET_MS).toISOString()
        const refreshIso = new Date(kickoffMs + OFFSET_MS).toISOString()
        return {
          gameweek,
          first_kickoff: kickoffIso,
          pick_deadline: pickDeadlineIso,
          odds_refresh_at: refreshIso,
        }
      })
      .sort((a, b) => a.gameweek - b.gameweek)

    if (rows.length === 0) {
      console.log('No fixtures found; nothing to upsert.')
      process.exit(0)
    }

    const { error } = await supabase
      .from('gameweek_deadlines')
      .upsert(rows, { onConflict: 'gameweek' })

    if (error) {
      throw new Error(`Failed to upsert gameweek_deadlines: ${error.message}`)
    }

    console.log(`Upserted ${rows.length} gameweek deadline rows.`)
    process.exit(0)
  } catch (error) {
    console.error('[update_gameweek_deadlines] Fatal error:', error)
    process.exit(1)
  }
}

void main()
