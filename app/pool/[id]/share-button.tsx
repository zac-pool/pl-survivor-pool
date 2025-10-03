'use client'

import { useState, useTransition } from 'react'
import { getShareMessage } from '../actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SHARE_TEXT = 'Copy Invite'
const PLACEHOLDER_LINK = 'https://pl-survivor-pool.vercel.app/'

type ShareButtonProps = {
  poolId: string
  className?: string
}

export default function ShareButton({ poolId, className }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleShare = () => {
    startTransition(async () => {
      const result = await getShareMessage(poolId)
      const shareMessage = result?.success && result.message
        ? result.message
        : `Join our PL Survivor Pool\n${PLACEHOLDER_LINK}`

      try {
        if (navigator.share) {
          await navigator.share({ text: shareMessage })
          setFeedback('Invite ready to send!')
          return
        }

        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(shareMessage)
          setFeedback('Invite copied to clipboard!')
          return
        }

        // Fallback when clipboard/share not available
        setFeedback('Share this invite: ' + shareMessage)
      } catch (error) {
        console.error('ShareButton: invite share failed', error)
        setFeedback('Copy failed. Share this invite: ' + shareMessage)
      }
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        type="button"
        onClick={handleShare}
        className="w-full rounded-full bg-[#38003c] px-6 py-5 text-sm font-semibold text-white shadow-lg shadow-[#38003c]/30 hover:bg-[#2a002d]"
        disabled={isPending}
      >
        {isPending ? 'Generating…' : SHARE_TEXT}
      </Button>
      {feedback ? (
        <p className="text-xs text-[#6f5c97]">{feedback}</p>
      ) : null}
    </div>
  )
}
