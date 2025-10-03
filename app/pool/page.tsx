'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PoolPage() {
  const params = useParams()
  const router = useRouter()
  const [pool, setPool] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [picks, setPicks] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [currentWeek] = useState(7) // Hardcoded for now
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPoolData()
  }, [params.id])

  const loadPoolData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)

    // Load pool info
    const { data: poolData } = await supabase
      .from('pools')
      .select('*')
      .eq('id', params.id)
      .single()
    
    if (poolData) setPool(poolData)

    // Load members
    const { data: membersData } = await supabase
      .from('pool_members')
      .select(`
        *,
        profiles (username)
      `)
      .eq('pool_id', params.id)
    
    if (membersData) setMembers(membersData)

    // Load teams
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .order('name')
    
    if (teamsData) setTeams(teamsData)

    // Load user's picks
    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('pool_id', params.id)
      .eq('user_id', user.id)
    
    if (picksData) setPicks(picksData)
    
    setLoading(false)
  }

  const submitPick = async () => {
    if (!selectedTeam || !user) return

    const { error } = await supabase
      .from('picks')
      .insert({
        pool_id: params.id,
        user_id: user.id,
        gameweek: currentWeek,
        team_id: selectedTeam
      })

    if (!error) {
      await loadPoolData()
      setSelectedTeam(null)
    }
  }

  const usedTeams = picks.map(p => p.team_id)
  const currentPick = picks.find(p => p.gameweek === currentWeek)

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{pool?.name}</h1>
            <p className="text-gray-600">Code: {pool?.code}</p>
          </div>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Make Pick Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Gameweek {currentWeek} Pick</CardTitle>
            </CardHeader>
            <CardContent>
              {currentPick ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-green-800">
                    You picked: {teams.find(t => t.id === currentPick.team_id)?.name}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    <label className="text-sm font-medium">Select a team:</label>
                    <select 
                      className="w-full p-2 border rounded-lg"
                      value={selectedTeam || ''}
                      onChange={(e) => setSelectedTeam(Number(e.target.value))}
                    >
                      <option value="">Choose...</option>
                      {teams.map(team => (
                        <option 
                          key={team.id} 
                          value={team.id}
                          disabled={usedTeams.includes(team.id)}
                        >
                          {team.name} {usedTeams.includes(team.id) ? '(USED)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button 
                    onClick={submitPick}
                    disabled={!selectedTeam}
                    className="w-full bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Submit Pick
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Standings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Pool Standings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map((member, index) => (
                  <div 
                    key={member.id}
                    className={`p-3 rounded-lg ${
                      member.user_id === user?.id ? 'bg-purple-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">
                          {index + 1}. {member.profiles?.username || 'Unknown'}
                        </span>
                        {member.user_id === user?.id && 
                          <span className="ml-2 text-xs text-purple-600">(You)</span>
                        }
                      </div>
                      <div className="text-sm">
                        {member.status === 'alive' ? (
                          <span className="text-green-600">
                            {member.lives_remaining} {member.lives_remaining === 1 ? 'life' : 'lives'}
                          </span>
                        ) : (
                          <span className="text-red-600">OUT</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Your Previous Picks */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Your Previous Picks</CardTitle>
            </CardHeader>
            <CardContent>
              {picks.length === 0 ? (
                <p className="text-gray-500">No picks yet</p>
              ) : (
                <div className="space-y-2">
                  {picks
                    .sort((a, b) => b.gameweek - a.gameweek)
                    .map(pick => (
                      <div key={pick.id} className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Week {pick.gameweek}</span>
                        <span className="font-medium">
                          {teams.find(t => t.id === pick.team_id)?.name}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pool Info */}
          <Card>
            <CardHeader>
              <CardTitle>Pool Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Share Code</p>
                <p className="text-2xl font-bold text-purple-600">{pool?.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Players</p>
                <p className="text-lg font-medium">{members.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Prize Pool</p>
                <p className="text-lg font-medium">£{members.length * 10}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
