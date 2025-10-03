'use client'

import { FormEvent, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPoolAction, joinPoolAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPoolRole, type PoolRole, POOL_CODE_LENGTH } from '@/lib/pools'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'

export type DashboardPoolMembership = {
  membershipId: string
  poolId: string
  role: PoolRole
  status: string | null
  livesRemaining: number | null
  membersCount: number | null
  currentPickTeam?: string | null
  currentPickStatus?: string | null
  pool: {
    id: string
    name: string
    code: string | null
    lives_per_player: number | null
  } | null
}

type OddsStatus = {
  isUpdating: boolean
  deadline?: string | null
  refreshAt?: string | null
  snapshotTakenAt?: string | null
}

export type DashboardClientProps = {
  pools: DashboardPoolMembership[]
  fetchError?: string
  activePoolId?: string | null
  oddsStatus: OddsStatus
}

export default function DashboardClient({
  pools,
  fetchError,
  activePoolId,
  oddsStatus,
}: DashboardClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const refreshLabel = oddsStatus.refreshAt ? new Date(oddsStatus.refreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null

  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  const [createName, setCreateName] = useState('')
  const [createLives, setCreateLives] = useState<'1' | '2' | '3'>('2')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<{ poolCode: string | null; poolId: string; livesPerPlayer?: number } | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<{ poolCode: string | null; poolId: string } | null>(null)

  const [isCreating, startCreating] = useTransition()
  const [isJoining, startJoining] = useTransition()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const resetCreateDialog = () => {
    setCreateName('')
    setCreateLives('2')
    setCreateError(null)
    setCreateSuccess(null)
  }

  const resetJoinDialog = () => {
    setJoinCode('')
    setJoinError(null)
    setJoinSuccess(null)
  }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)

    const trimmedName = createName.trim()
    if (!trimmedName) {
      setCreateError('Pool name is required.')
      return
    }

    const livesOption = Number(createLives)
    if (!Number.isInteger(livesOption) || livesOption < 1 || livesOption > 3) {
      setCreateError('Choose how many lives each player gets (1, 2, or 3).')
      return
    }

    startCreating(async () => {
      const result = await createPoolAction({ name: trimmedName, lives: livesOption })

      if (!result?.success) {
        setCreateError(result?.error ?? 'Something went wrong creating the pool.')
        return
      }

      if (!result.poolId) {
        setCreateError('Pool created but we could not determine its id. Please refresh and try again.')
        setCreateName('')
        setCreateLives('2')
        return
      }

      setCreateSuccess({
        poolCode: result.poolCode ?? null,
        poolId: String(result.poolId),
        livesPerPlayer: result.livesPerPlayer ?? livesOption,
      })
      setCreateName('')
      setCreateLives('2')
      router.refresh()
      setShowCreate(false)
      router.push(`/pool/${result.poolId}`)
    })
  }

  const handleJoinSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setJoinError(null)
    setJoinSuccess(null)

    const trimmedCode = joinCode.trim()
    if (!trimmedCode) {
      setJoinError('Enter the pool code to continue.')
      return
    }

    const normalizedCode = trimmedCode.length === POOL_CODE_LENGTH ? trimmedCode.toUpperCase() : trimmedCode

    startJoining(async () => {
      const result = await joinPoolAction({ poolCode: normalizedCode })

      if (!result?.success) {
        setJoinError(result?.error ?? 'Something went wrong joining the pool.')
        return
      }

      setJoinSuccess({
        poolCode: result.poolCode ?? null,
        poolId: result.poolId ? String(result.poolId) : '',
      })
      setJoinCode('')
      router.refresh()
      setShowJoin(false)
      router.push(`/pool/${result.poolId}`)
    })
  }

  const displayPools = pools
  const derivedActivePoolId = activePoolId ?? searchParams?.get('pool') ?? null
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-[#2c1147] sm:text-3xl">Your Pools</h1>
          <Button onClick={handleLogout} variant="outline" className="w-full sm:w-auto">
            Logout
          </Button>
        </div>

        {fetchError ? (
          <Card>
            <CardContent className="py-4 text-sm text-red-600">{fetchError}</CardContent>
          </Card>
        ) : null}

        {oddsStatus.isUpdating ? (
          <div className="rounded-3xl bg-gradient-to-r from-purple-100 to-purple-200 p-4 text-sm text-purple-800 shadow-sm">
            <p className="font-semibold">Odds updating…</p>
            <p className="text-xs">
              New bookmaker prices will appear shortly
              {refreshLabel ? ` (refresh by ${refreshLabel})` : ''}.
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Dialog
              open={showCreate}
              onOpenChange={(open) => {
                setShowCreate(open)
                if (!open) {
                  resetCreateDialog()
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-full bg-purple-600 text-white hover:bg-purple-700 sm:w-auto">
                  Create Pool
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form className="space-y-6" onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle>Create a new pool</DialogTitle>
                    <DialogDescription>
                      Give your league a name. We will generate a shareable code automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="pool-name">Pool name</Label>
                    <Input
                      id="pool-name"
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder="e.g. North London Derby Club"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pool-lives">Lives per player</Label>
                    <select
                      id="pool-lives"
                      value={createLives}
                      onChange={(event) => setCreateLives(event.target.value as '1' | '2' | '3')}
                      className="h-12 rounded-full border-[#d6c7ff] bg-white text-sm font-medium text-[#2c1147]"
                    >
                      <option value="1">1 life</option>
                      <option value="2">2 lives</option>
                      <option value="3">3 lives</option>
                    </select>
                  </div>
                  {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
                  {createSuccess ? (
                    <div className="rounded-[16px] bg-purple-50 p-4 text-sm text-purple-700">
                      Pool created! Share code{' '}
                      <span className="font-semibold">{createSuccess.poolCode ?? 'pending'}</span> •{' '}
                      {(createSuccess.livesPerPlayer ?? Number(createLives))}{' '}
                      {(createSuccess.livesPerPlayer ?? Number(createLives)) === 1 ? 'life' : 'lives'} per player.
                    </div>
                  ) : null}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                      Close
                    </Button>
                    <Button
                      type="submit"
                      className="bg-purple-600 text-white hover:bg-purple-700"
                      disabled={isCreating}
                    >
                      {isCreating ? 'Creating…' : 'Create Pool'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={showJoin}
              onOpenChange={(open) => {
                setShowJoin(open)
                if (!open) {
                  resetJoinDialog()
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  Join Pool
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form className="space-y-6" onSubmit={handleJoinSubmit}>
                  <DialogHeader>
                    <DialogTitle>Join a pool</DialogTitle>
                    <DialogDescription>Enter the pool code your friend shared with you.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="pool-code">Pool code</Label>
                    <Input
                      id="pool-code"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value)}
                      placeholder={`Enter ${POOL_CODE_LENGTH}-character code or pool ID`}
                      maxLength={36}
                      required
                    />
                  </div>
                  {joinError ? <p className="text-sm text-red-600">{joinError}</p> : null}
                  {joinSuccess ? (
                    <div className="rounded-[16px] bg-green-50 p-4 text-sm text-green-700">
                      You are in! Pool code{' '}
                      <span className="font-semibold">{joinSuccess.poolCode ?? 'pending'}</span> confirmed.
                    </div>
                  ) : null}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowJoin(false)}>
                      Close
                    </Button>
                    <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-700" disabled={isJoining}>
                      {isJoining ? 'Joining…' : 'Join Pool'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayPools.map((membership) => {
            const isActive = membership.poolId === derivedActivePoolId
            const livesPerPlayer = membership.pool?.lives_per_player ?? null

            return (
              <Link
                key={membership.poolId}
                href={`/pool/${membership.poolId}`}
                className="w-full text-left"
              >
                <Card
                  className={cn(
                    'w-full bg-white transition-shadow cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                    isActive ? 'border-2 border-purple-600 shadow-lg' : 'border border-transparent'
                  )}
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle>{membership.pool?.name ?? 'Pool'}</CardTitle>
                        <p className="text-sm text-gray-600">Code: {membership.pool?.code ?? '--'}</p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-semibold',
                          membership.currentPickTeam
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        )}
                      >
                        {membership.currentPickTeam ? `Picked: ${membership.currentPickTeam}` : 'No pick yet'}
                      </span>
                    </div>
                    {membership.currentPickTeam && membership.currentPickStatus ? (
                      <p className="text-xs uppercase tracking-wider text-emerald-600">
                        Status: {membership.currentPickStatus.toUpperCase()}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p>
                        Status{' '}
                        <span className={membership.status === 'alive' ? 'text-green-600' : 'text-red-600'}>
                          {(membership.status || 'unknown').toUpperCase()}
                        </span>
                      </p>
                      <p>Lives remaining: {membership.livesRemaining ?? '--'}</p>
                      <p className="text-xs text-gray-500">
                        {livesPerPlayer != null ? `${livesPerPlayer} ${livesPerPlayer === 1 ? 'life' : 'lives'} per player` : 'Lives per player not set'}
                      </p>
                      <p>Pick: {membership.currentPickTeam ?? '--'}</p>
                      <p>Role: {formatPoolRole(membership.role)}</p>
                      <p>Members: {membership.membersCount ?? '--'}</p>
                      {!membership.pool && (
                        <p className="text-xs text-gray-500">Pool details unavailable</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {displayPools.length === 0 && !fetchError ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-600 mb-4">You're not in any pools yet</p>
              <p className="text-sm">Create or join a pool to get started!</p>
            </CardContent>
          </Card>
        ) : null}

      </div>
    </div>
  )
}
