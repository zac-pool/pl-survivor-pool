'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { removePoolMemberAction } from '../actions'

type ManageMember = {
  membershipId: number
  userId: string
  name: string
  isOwnerMember: boolean
  isCurrentUser: boolean
  status: string | null
  livesRemaining: number | null
}

type ManageMembersDialogProps = {
  poolId: string
  members: ManageMember[]
  canManage: boolean
  triggerClassName?: string
  triggerVariant?: 'primary' | 'outline'
}

export default function ManageMembersDialog({
  poolId,
  members,
  canManage,
  triggerClassName,
  triggerVariant = 'outline',
}: ManageMembersDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!canManage) {
    return null
  }

  const handleRemove = (membershipId: number) => {
    startTransition(async () => {
      const result = await removePoolMemberAction({ poolId, membershipId })

      if (!result?.success) {
        setFeedback(result?.error ?? 'Unable to remove this member right now.')
        return
      }

      setFeedback('Member removed.')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (!nextOpen) setFeedback(null)
    }}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant === 'primary' ? 'default' : 'outline'}
          className={cn(
            triggerVariant === 'primary'
              ? 'w-full rounded-full bg-[#38003c] px-6 py-5 text-sm font-semibold text-white shadow-lg shadow-[#38003c]/30 hover:bg-[#2a002d] sm:w-auto'
              : 'w-full rounded-full border-[#cfc1ff] px-6 py-5 text-sm font-semibold text-[#38003c] hover:bg-purple-50 sm:w-auto',
            triggerClassName
          )}
        >
          Manage Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage members</DialogTitle>
          <DialogDescription>Remove players from this pool if needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-gray-600">No members loaded.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => {
                const statusLabel = member.status ? member.status.toUpperCase() : 'UNKNOWN'
                return (
                  <li
                    key={member.membershipId}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-[#2c1147]">{member.name}</span>
                      <span className="text-xs text-gray-500">
                        {statusLabel} • {member.livesRemaining ?? 0}{' '}
                        {(member.livesRemaining ?? 0) === 1 ? 'life' : 'lives'}
                      </span>
                      {member.isOwnerMember ? (
                        <span className="text-[10px] uppercase tracking-widest text-purple-500">Owner</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {member.isOwnerMember ? (
                        <span className="text-[11px] uppercase text-gray-400">Owner</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || member.isCurrentUser}
                          onClick={() => handleRemove(member.membershipId)}
                          className="border-rose-200 text-rose-600 hover:bg-rose-50"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <div className="flex w-full flex-col gap-2 text-left">
            {feedback ? <p className="text-xs text-gray-600">{feedback}</p> : null}
            <Button onClick={() => setOpen(false)} variant="outline" className="self-end">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
