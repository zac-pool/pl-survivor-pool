export type OddsBoardRow = {
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

function formatPercent(value: number | null) {
  if (value == null) return '–'
  return `${(value * 100).toFixed(1)}%`
}

export function OddsBoard({ rows, gameweek, snapshotTakenAt }: { rows: OddsBoardRow[]; gameweek?: number | null; snapshotTakenAt?: string | null }) {
  const snapshotLabel = snapshotTakenAt ? new Date(snapshotTakenAt).toLocaleString() : null

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold">Odds Board</h3>
      {gameweek != null && (
        <p className="mb-4 text-xs text-gray-500">
          Gameweek {gameweek}
          {snapshotLabel ? ` • Snapshot ${snapshotLabel}` : " • Snapshot pending"}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No odds available for this gameweek yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const when = new Date(r.commence_time).toLocaleString()
            return (
              <div
                key={r.event_id}
                className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {r.home_team} vs {r.away_team}
                  </div>
                  <div className="text-xs text-gray-500">{when}</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {[
                    { label: 'Home', price: r.best_home, prob: r.p_home },
                    { label: 'Draw', price: r.best_draw, prob: r.p_draw },
                    { label: 'Away', price: r.best_away, prob: r.p_away },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="font-semibold">{item.price ?? '–'}</div>
                      <div className="text-xs text-gray-500">{formatPercent(item.prob)}</div>
                      <div className="mt-1 text-[10px] uppercase text-gray-400">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
