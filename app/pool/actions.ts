'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pl-survivor-pool.vercel.app'

const submitPickSchema = z.object({
  poolId: z.string().min(1, 'Pool is required'),
  teamId: z.coerce.number().int('Select a valid team'),
  gameweek: z.coerce
    .number()
    .int('Gameweek must be an integer')
    .positive('Gameweek must be positive'),
})

export async function submitPickAction(formData: unknown) {
  const result = submitPickSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? 'Invalid pick submission',
    }
  }

  const { poolId, teamId, gameweek } = result.data

  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('submitPickAction: unable to fetch user', userError)
      return {
        success: false,
        error: 'Unable to verify your session. Please re-login.',
      }
    }

    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to make a pick.',
      }
    }

    const { data: membership, error: membershipError } = await supabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('submitPickAction: membership lookup failed', membershipError)
      return {
        success: false,
        error: 'Unable to verify your pool membership. Please try again later.',
      }
    }

    if (!membership) {
      return {
        success: false,
        error: 'You are not a member of this pool.',
      }
    }

    const { data: teamRow, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .maybeSingle()

    if (teamError || !teamRow) {
      return {
        success: false,
        error: 'Selected team could not be found.',
      }
    }

    const { data: historicalPick } = await supabase
      .from('picks')
      .select('id, gameweek')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .neq('gameweek', gameweek)
      .maybeSingle()

    if (historicalPick) {
      return {
        success: false,
        error: 'You have already used this team earlier in the season.',
      }
    }

    const { data: existingPick } = await supabase
      .from('picks')
      .select('id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .eq('gameweek', gameweek)
      .maybeSingle()

    let actionError: { message: string } | null = null

    if (existingPick) {
      const { error: updateError } = await adminSupabase
        .from('picks')
        .update({ team_id: teamId })
        .eq('id', existingPick.id)

      if (updateError) {
        actionError = updateError
      }
    } else {
      const { error: insertError } = await adminSupabase.from('picks').insert({
        pool_id: poolId,
        user_id: user.id,
        gameweek,
        team_id: teamId,
      })

      if (insertError) {
        actionError = insertError
      }
    }

    if (actionError) {
      console.error('submitPickAction: failed to upsert pick', actionError)
      return {
        success: false,
        error: 'We could not save your pick. Please try again.',
      }
    }

    revalidatePath(`/pool/${poolId}`)
    revalidatePath('/dashboard')

    return {
      success: true,
      message: `${teamRow.name} locked in for GW${gameweek}.`,
    }
  } catch (error) {
    console.error('submitPickAction: unexpected error', error)
    return {
      success: false,
      error: 'Unexpected error when saving pick. Please try again.',
    }
  }
}

export async function getShareMessage(poolId: string) {
  const supabase = await createClient()

  const { data: pool, error } = await supabase
    .from('pools')
    .select('code, name')
    .eq('id', poolId)
    .maybeSingle()

  if (error || !pool) {
    return {
      success: false,
      message: 'Unable to load pool details. Copy the code manually.',
    }
  }

  const sanitizedCode = pool.code ?? '—'
  const joinUrl = `${APP_URL.replace(/\/$/, '')}/pool`

  const shareMessage = `Join our PL Survivor Pool: ${pool.name || 'Survivor Pool'}\n` +
    `Pool Code: ${sanitizedCode}\n` +
    `Sign up at ${joinUrl} and use the code to enter.`

  return {
    success: true,
    message: shareMessage,
  }
}

const removePoolMemberSchema = z.object({
  poolId: z.string().min(1, 'Pool is required'),
  membershipId: z.coerce.number().int('Invalid member reference').positive('Invalid member reference'),
})

export async function removePoolMemberAction(formData: unknown) {
  const result = removePoolMemberSchema.safeParse(formData)

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? 'Invalid request',
    }
  }

  const { poolId, membershipId } = result.data

  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        success: false,
        error: 'You must be logged in to manage members.',
      }
    }

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, created_by')
      .eq('id', poolId)
      .maybeSingle()

    if (poolError || !pool) {
      return {
        success: false,
        error: 'Unable to load pool details.',
      }
    }

    if (pool.created_by !== user.id) {
      return {
        success: false,
        error: 'Only the pool owner can remove members.',
      }
    }

    const { data: membership } = await supabase
      .from('pool_members')
      .select('user_id')
      .eq('id', membershipId)
      .maybeSingle()

    if (!membership) {
      return {
        success: false,
        error: 'Member not found.',
      }
    }

    if (membership.user_id === pool.created_by) {
      return {
        success: false,
        error: 'You cannot remove the pool owner.',
      }
    }

    const { error: deleteError } = await adminSupabase
      .from('pool_members')
      .delete()
      .eq('id', membershipId)

    if (deleteError) {
      console.error('removePoolMemberAction: delete failed', deleteError)
      return {
        success: false,
        error: 'Unable to remove that member right now.',
      }
    }

    revalidatePath(`/pool/${poolId}`)
    revalidatePath('/dashboard')

    return {
      success: true,
    }
  } catch (error) {
    console.error('removePoolMemberAction: unexpected error', error)
    return {
      success: false,
      error: 'Unexpected error removing member. Please try again.',
    }
  }
}
