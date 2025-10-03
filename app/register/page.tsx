'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    const ensureSignedOut = async () => {
      const { data } = await supabase.auth.getSession()
      if (!cancelled && data?.session) {
        await supabase.auth.signOut()
      }
    }

    void ensureSignedOut()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Sign up the user (fresh session enforced in effect above)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Create profile
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
      })

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      setLoading(false)
      router.push('/dashboard')
      router.refresh()
      return
    }

    setLoading(false)
    setError('Check your email to confirm the account, then log in to continue.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-white px-4">
      <div className="w-full max-w-md space-y-6 py-10">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-semibold text-[#1f0a33]">Create account</h1>
          <p className="text-sm text-gray-600">Join the survivor pool</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
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
                minLength={6}
              />
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>
          <Button
            type="submit"
            className="w-full rounded-full bg-purple-600 py-3 text-sm font-semibold text-white shadow-md shadow-purple-200 transition hover:bg-purple-700"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </Button>
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-purple-600 hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
