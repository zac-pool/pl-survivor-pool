import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || (!serviceRoleKey && !fallbackKey)) {
  throw new Error('Missing Supabase admin environment variables')
}

export function createAdminClient() {
  const key = serviceRoleKey ?? fallbackKey
  return createClient(url as string, key as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
