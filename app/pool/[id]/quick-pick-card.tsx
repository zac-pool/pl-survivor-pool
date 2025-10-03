'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitPickAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type QuickPickTeamOption = {
  id: number
  name: string
  used: boolean
}

type QuickPickCardProps = {
  poolId: string
  currentGameweek: number
  deadlineCountdown: string
  currentPick: {
    teamId: number | null
    teamName: string | null
    status: string | null
  }
  teams: QuickPickTeamOption[]
  teamsUsedNames: string[]
  className?: string
}

export default function QuickPickCard({
  poolId,
  currentGameweek,
  deadlineCountdown,
  currentPick,
  teams,
  teamsUsedNames,
  className,
}: QuickPickCardProps) {
  const router = useRouter()
  const [selectedTeam, setSelectedTeam] = useState<string>(currentPick.teamId ? String(currentPick.teamId) : '')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasExistingPick = Boolean(currentPick.teamName)

  const handleSubmit = () => {
    if (!selectedTeam) {
      setFeedback({ type: 'error', text: 'Select a team to continue.' })
      return
    }

    startTransition(async () => {
      const result = await submitPickAction({
        poolId,
        teamId: Number(selectedTeam),
        gameweek: currentGameweek,
      })

      if (!result?.success) {
        setFeedback({ type: 'error', text: result?.error ?? 'Something went wrong saving your pick.' })
        return
      }

      setFeedback({ type: 'success', text: result.message ?? 'Pick saved.' })
      router.refresh()
    })
  }

  const MAX_TEAMS_DISPLAY = 10
  const displayedTeams = teamsUsedNames.slice(0, MAX_TEAMS_DISPLAY)
  const remainingTeamsCount = teamsUsedNames.length - displayedTeams.length

  return (
    <Card className={cn('rounded-[28px] border border-white/70 bg-white shadow-xl shadow-purple-100', className)}>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm uppercase tracking-[0.3em] text-[#73608f]">
              GW{currentGameweek} Pick
            </CardTitle>
            <p className="text-2xl font-semibold text-[#2c1147]">
              {currentPick.teamName ? `Picked: ${currentPick.teamName}` : 'No pick submitted'}
            </p>
          </div>
          <div className="rounded-[20px] bg-[#f3eaff] px-4 py-2 text-xs font-semibold text-[#4f2590]">
            Deadline in {deadlineCountdown}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[#8c6fc8]">Select Team</p>
          <select
            value={selectedTeam}
            onChange={(event) => setSelectedTeam(event.target.value)}
            disabled={isPending}
            className="h-12 rounded-full border-[#d6c7ff] bg-white text-sm font-medium text-[#2c1147]"
          >
            <option value="">Choose a team</option>
            {teams.map((team) => {
              const isLocked = team.used
              const lockPrefix = isLocked ? '🔒 ' : ''
              return (
                <option key={team.id} value={String(team.id)} disabled={isLocked}>
                  {`${lockPrefix}${team.name}${isLocked ? ' (locked)' : ''}`}
                </option>
              )
            })}
          </select>
          <p className="text-xs text-[#7a699a]">🔒 indicates a team you've already used and can no longer select.</p>
        </div>

        {teamsUsedNames.length > 0 ? (
          <div className="rounded-[20px] border border-dashed border-rose-200 bg-rose-50/80 p-4 text-xs text-[#6f5c97]">
            <p className="mb-2 font-semibold text-[#4b2c83]">Teams you have already used</p>
            <div className="flex flex-wrap gap-2">
              {displayedTeams.map((team) => (
                <span key={team} className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 font-medium text-[#9b1c4f]">
                  🔒 {team}
                </span>
              ))}
            </div>
            {remainingTeamsCount > 0 ? (
              <p className="mt-2 text-[11px] text-[#9b1c4f]">
                +{remainingTeamsCount} more team{remainingTeamsCount === 1 ? '' : 's'} locked for this season.
              </p>
            ) : null}
          </div>
        ) : null}

        {feedback ? (
          <div
            className={`rounded-[16px] px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            {feedback.text}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleSubmit}
            className="rounded-full bg-[#38003c] px-6 py-5 text-sm font-semibold text-white shadow-lg shadow-[#38003c]/30 hover:bg-[#2a002d]"
            disabled={
              isPending ||
              !selectedTeam ||
              (hasExistingPick && Number(selectedTeam) === currentPick.teamId)
            }
          >
            {isPending ? 'Saving…' : hasExistingPick ? 'Update Pick' : `Confirm for GW${currentGameweek}`}
          </Button>
          {hasExistingPick && (
            <span className="text-xs text-[#7a699a]">
              Updating will overwrite your existing pick until the deadline.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
