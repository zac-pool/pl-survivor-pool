'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setLoading(false)
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-white px-4">
      <div className="w-full max-w-md space-y-6 py-10">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-semibold text-[#1f0a33]">Welcome back</h1>
          <p className="text-sm text-gray-600">Log in to your survivor pool</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>
          <Button
            type="submit"
            className="w-full rounded-full bg-purple-600 py-3 text-sm font-semibold text-white shadow-md shadow-purple-200 transition hover:bg-purple-700"
            disabled={loading}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold text-purple-600 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
