'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { POOL_CODE_LENGTH } from '@/lib/pools'

const createPoolSchema = z.object({
  name: z
    .string()
    .min(3, 'Pool name must be at least 3 characters long')
    .max(100, 'Pool name is too long'),
  lives: z
    .coerce
    .number()
    .int('Lives must be a whole number')
    .min(1, 'Lives must be between 1 and 3')
    .max(3, 'Lives must be between 1 and 3'),
})

const joinPoolSchema = z.object({
  poolCode: z
    .string()
    .trim()
    .refine(
      (value) => {
        const length = value.length
        return length === POOL_CODE_LENGTH || length === 36
      },
      `Enter a ${POOL_CODE_LENGTH}-character code or pool ID`
    ),
})

function generatePoolCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''

  while (code.length < POOL_CODE_LENGTH) {
    const bytes = crypto.randomBytes(POOL_CODE_LENGTH)
    for (let index = 0; index < bytes.length && code.length < POOL_CODE_LENGTH; index += 1) {
      const byte = bytes[index]
      code += alphabet[byte % alphabet.length]
    }
  }

  return code
}

export async function createPoolAction(formData: unknown) {
  const result = createPoolSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? 'Invalid pool details provided',
    }
  }

  const { name, lives } = result.data
  const livesPerPlayer = lives

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('createPoolAction: failed to fetch auth user', {
        message: userError.message,
      })
      return {
        success: false,
        error: 'Unable to verify your session. Please re-login.',
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create a pool.',
      }
    }

    const poolCode = generatePoolCode()

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name,
        code: poolCode,
        created_by: user.id,
        lives_per_player: livesPerPlayer,
      })
      .select('id, code, lives_per_player')
      .single()

    if (poolError || !pool) {
      console.error('createPoolAction: pool insert failed', {
        message: poolError?.message,
        details: poolError?.details,
        hint: poolError?.hint,
      })
      return {
        success: false,
        error: 'We could not create the pool right now. Please try again.',
      }
    }

    const initialLives = pool.lives_per_player ?? livesPerPlayer

    const { error: memberError } = await supabase.from('pool_members').insert({
      pool_id: pool.id,
      user_id: user.id,
      status: 'alive',
      lives_remaining: initialLives,
    })

    if (memberError) {
      console.error('createPoolAction: pool_members insert failed', {
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
      })
      return {
        success: false,
        error: 'Pool created, but we could not add you as a member. Contact support.',
      }
    }

    revalidatePath('/dashboard')

    return {
      success: true,
      poolId: String(pool.id),
      poolCode,
      livesPerPlayer: initialLives,
    }
  } catch (error) {
    console.error('createPoolAction: unexpected error', error)
    return {
      success: false,
      error: 'Unexpected error when creating pool. Please try again.',
    }
  }
}

type PoolsJoinRow = {
  id: number
  code: string | null
  lives_per_player: number | null
}

export async function joinPoolAction(formData: unknown) {
  const result = joinPoolSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? 'Invalid pool code provided',
    }
  }

  const rawPoolCode = result.data.poolCode.trim()
  const normalizedPoolCode = rawPoolCode.length === POOL_CODE_LENGTH ? rawPoolCode.toUpperCase() : rawPoolCode

  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('joinPoolAction: failed to fetch auth user', {
        message: userError.message,
      })
      return {
        success: false,
        error: 'Unable to verify your session. Please re-login.',
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to join a pool.',
      }
    }

    const fetchPoolBy = async (column: 'code' | 'id', value: string | number) => {
      const { data, error } = await adminSupabase
        .from('pools')
        .select('id, code, lives_per_player')
        .eq(column, value)
        .maybeSingle()
      return { data: (data as PoolsJoinRow | null) ?? null, error }
    }

    let pool: PoolsJoinRow | null = null
    let poolLookupError: { message?: string; details?: any; hint?: any } | null = null

    if (normalizedPoolCode.length === POOL_CODE_LENGTH) {
      const { data, error } = await fetchPoolBy('code', normalizedPoolCode)
      pool = data
      poolLookupError = error
    } else {
      const maybeNumber = Number(normalizedPoolCode)
      if (!Number.isNaN(maybeNumber) && Number.isFinite(maybeNumber)) {
        const { data, error } = await fetchPoolBy('id', maybeNumber)
        pool = data
        poolLookupError = error
      }

      if (!pool) {
        const { data, error } = await fetchPoolBy('code', normalizedPoolCode.toUpperCase())
        pool = data
        poolLookupError = pool ? null : error
      }
    }

    if (!pool) {
      console.error('joinPoolAction: pool lookup failed', {
        message: poolLookupError?.message ?? 'Not found',
        details: poolLookupError?.details,
        hint: poolLookupError?.hint,
      })
      return {
        success: false,
        error: 'We could not find a pool with that code.',
      }
    }

    const {
      data: existingMembership,
      error: membershipFetchError,
    } = await adminSupabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', pool.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipFetchError) {
      console.error('joinPoolAction: membership lookup failed', {
        message: membershipFetchError.message,
        details: membershipFetchError.details,
        hint: membershipFetchError.hint,
      })
      return {
        success: false,
        error: 'Unable to verify your membership. Please try again later.',
      }
    }

    if (existingMembership) {
      return {
        success: false,
        error: 'You are already part of this pool.',
      }
    }

    const livesPerPlayer = pool.lives_per_player ?? 1

    const { error: joinError } = await adminSupabase.from('pool_members').insert({
      pool_id: pool.id,
      user_id: user.id,
      status: 'alive',
      lives_remaining: livesPerPlayer,
    })

    if (joinError) {
      console.error('joinPoolAction: pool_members insert failed', {
        message: joinError.message,
        details: joinError.details,
        hint: joinError.hint,
      })
      return {
        success: false,
        error: 'We could not add you to the pool. Please try again.',
      }
    }

    revalidatePath('/dashboard')

    return {
      success: true,
      poolId: String(pool.id),
      poolCode: pool.code,
    }
  } catch (error) {
    console.error('joinPoolAction: unexpected error', error)
    return {
      success: false,
      error: 'Unexpected error when joining pool. Please try again.',
    }
  }
}
