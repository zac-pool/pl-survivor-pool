'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResultsAdmin() {
  const [teams, setTeams] = useState<any[]>([])
  const [gameweek, setGameweek] = useState(7)
  const [results, setResults] = useState<any>({})
  const supabase = createClient()

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('name')
    
    if (data) setTeams(data)
  }

  const saveResults = async () => {
    const resultsToSave = Object.entries(results).map(([teamId, result]) => ({
      gameweek,
      team_id: parseInt(teamId),
      result: result as string,
      opponent_id: 1, // Simplified - you'd want proper opponent tracking
      is_home: true,
      match_date: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('results')
      .upsert(resultsToSave, {
        onConflict: 'gameweek,team_id'
      })

    if (!error) {
      alert('Results saved!')
      setResults({})
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Enter Results - Gameweek {gameweek}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="flex items-center gap-4">
                  <span className="w-40 font-medium">{team.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={results[team.id] === 'W' ? 'default' : 'outline'}
                      onClick={() => setResults({...results, [team.id]: 'W'})}
                    >
                      Win
                    </Button>
                    <Button
                      size="sm"
                      variant={results[team.id] === 'D' ? 'default' : 'outline'}
                      onClick={() => setResults({...results, [team.id]: 'D'})}
                    >
                      Draw
                    </Button>
                    <Button
                      size="sm"
                      variant={results[team.id] === 'L' ? 'default' : 'outline'}
                      onClick={() => setResults({...results, [team.id]: 'L'})}
                    >
                      Loss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              className="w-full mt-6"
              onClick={saveResults}
            >
              Save All Results
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}