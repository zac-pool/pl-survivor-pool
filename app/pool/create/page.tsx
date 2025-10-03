'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CreatePool() {
  const [poolName, setPoolName] = useState('')
  const [loading, setLoading] = useState(false)
  const [livesPerPlayer, setLivesPerPlayer] = useState<'1' | '2' | '3'>('2')
  const router = useRouter()
  const supabase = createClient()

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const poolCode = generateCode()
    const lives = Number(livesPerPlayer)

    // Create pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name: poolName,
        code: poolCode,
        created_by: user.id,
        lives_per_player: lives
      })
      .select()
      .single()

    if (!poolError && pool) {
      // Add creator as first member
      await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: user.id,
          lives_remaining: lives,
          status: 'alive'
        })

      router.push(`/pool/${pool.id}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Create Survivor Pool</CardTitle>
          <CardDescription>Start your own pool and invite friends</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreatePool}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="poolName">Pool Name</Label>
              <Input
                id="poolName"
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Champions League Pool"
                required
              />
            </div>
            <div>
              <Label htmlFor="poolLives">Lives per player</Label>
              <Select
                id="poolLives"
                value={livesPerPlayer}
                onChange={(event) => setLivesPerPlayer(event.target.value as '1' | '2' | '3')}
                className="mt-1 h-12 rounded-full border-[#d6c7ff] bg-white text-sm font-medium text-[#2c1147]"
              >
                <option value="1">1 life</option>
                <option value="2">2 lives</option>
                <option value="3">3 lives</option>
              </Select>
            </div>
          </CardContent>
          <div className="px-6 pb-6">
            <Button type="submit" className="w-full bg-purple-600 text-white hover:bg-purple-700" disabled={loading}>
              {loading ? 'Creating...' : 'Create Pool'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
