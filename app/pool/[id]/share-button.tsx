'use client'

import { useState, useTransition } from 'react'
import { getShareMessage } from '../actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SHARE_TEXT = 'Copy Invite'
const PLACEHOLDER_LINK = 'https://example.com/join'

type ShareButtonProps = {
  poolId: string
  className?: string
}

export default function ShareButton({ poolId, className }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleShare = () => {
    if (!('clipboard' in navigator)) {
      window.alert('Copy the code manually from the pool card.')
      return
    }

    startTransition(async () => {
      const result = await getShareMessage(poolId)

      if (!result?.success || !result.message) {
        setFeedback('Pool code copied! Visit the pool card to share manually.')
        return
      }

      try {
        await navigator.clipboard.writeText(result.message)
        setFeedback('Invite message copied to clipboard!')
      } catch (error) {
        console.error('ShareButton: clipboard write failed', error)
        setFeedback('Copy failed. You can share: ' + PLACEHOLDER_LINK)
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
