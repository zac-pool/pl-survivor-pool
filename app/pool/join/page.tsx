'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { joinPoolAction } from '@/app/dashboard/actions'

export default function JoinPool() {
  const [poolCode, setPoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const [isJoining, startJoining] = useTransition()

  const handleJoinPool = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = poolCode.trim()
    if (!trimmed) {
      setError('Enter the pool code to continue.')
      return
    }

    setLoading(true)

    startJoining(async () => {
      const result = await joinPoolAction({ poolCode: trimmed })

      if (!result?.success) {
        setError(result?.error ?? 'Unable to join this pool right now.')
        setLoading(false)
        return
      }

      setLoading(false)
      setPoolCode('')
      router.push(`/pool/${result.poolId}`)
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Join Pool</CardTitle>
          <CardDescription>Enter the 6-digit code to join</CardDescription>
        </CardHeader>
        <form onSubmit={handleJoinPool}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="poolCode">Pool Code</Label>
              <Input
                id="poolCode"
                type="text"
                value={poolCode}
                onChange={(e) => setPoolCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                required
                className="uppercase"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </CardContent>
          <div className="px-6 pb-6">
            <Button type="submit" className="w-full" disabled={loading || isJoining}>
              {loading || isJoining ? 'Joining...' : 'Join Pool'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
