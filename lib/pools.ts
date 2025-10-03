export const POOL_CODE_LENGTH = 6


export type PoolRole = 'owner' | 'admin' | 'player' | 'viewer' | null

export function formatPoolRole(role: PoolRole) {
  if (!role) return '--'
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'player') return 'Player'
  return role
}

export function normalizePoolRole(role: string | null): PoolRole {
  if (role === 'owner' || role === 'admin' || role === 'player' || role === 'viewer') {
    return role
  }
  return null
}

export function isOwner(role: PoolRole) {
  return role === 'owner'
}

export function isAdmin(role: PoolRole) {
  return role === 'owner' || role === 'admin'
}
