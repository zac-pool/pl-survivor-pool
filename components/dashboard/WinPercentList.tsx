export type WinPercentRow = {
  team: string
  opponent: string
  side: 'H' | 'A'
  win_pct: number | null
  commence_time: string
}

function formatWinPct(value: number | null) {
  if (value == null) return '–'
  return `${(value * 100).toFixed(1)}%`
}

function formatKickoffLabel(value: string) {
  try {
    return new Date(value).toLocaleString([], {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (error) {
    return value
  }
}

export function WinPercentList({ rows, gameweek }: { rows: WinPercentRow[]; gameweek?: number | null }) {
  const sortedRows = [...rows].sort((a, b) => (b.win_pct ?? 0) - (a.win_pct ?? 0))
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold">
        {gameweek != null ? `GW${gameweek} Odds` : 'Upcoming Odds'}
      </h3>
      {gameweek != null && (
        <p className="mb-4 text-xs text-gray-500">Gameweek {gameweek}</p>
      )}
      {sortedRows.length === 0 ? (
        <p className="text-sm text-gray-500">No win probability data available yet.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {sortedRows.map((r) => (
            <div
              key={`${r.team}-${r.opponent}-${r.commence_time}`}
              className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#2c1147]">{r.team}</span>
                  <span className="text-[11px] uppercase text-gray-400">({r.side === 'H' ? 'HOME' : 'AWAY'})</span>
                </div>
                <div className="text-xs text-gray-500">
                  {r.opponent} • {formatKickoffLabel(r.commence_time)}
                </div>
              </div>
              <div className="text-base font-semibold text-purple-700">{formatWinPct(r.win_pct)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
