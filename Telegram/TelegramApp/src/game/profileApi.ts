// Read-only client for the public profile endpoint (TelegramBot/server.mjs GET /api/profile).
// Profiles are built server-side from cloud-save syncs, so they may lag live play slightly.
import type { BigNumberData } from './core/BigNumber'
import type { LifetimeStats } from './gameplay/LifetimeStats'
import type { CardVariant } from './cards/variants'

export interface ShowcaseEntry {
  cardId: string
  variant: CardVariant
}

export interface PublicProfile {
  userId: number
  firstName: string | null
  username: string | null
  photoUrl: string | null
  firstSyncedAt: number | null
  highestStage: number | null
  relics: BigNumberData | null
  dailyStreak: number | null
  stats: LifetimeStats | null
  /** Ordered card showcase (owned cardId+variant pairs, server-validated). */
  showcase?: ShowcaseEntry[]
}

export async function fetchPublicProfile(apiBaseUrl: string | undefined, userId: number): Promise<PublicProfile | null> {
  if (!apiBaseUrl) return null
  try {
    const res = await fetch(`${apiBaseUrl}/api/profile?id=${userId}`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json()
    return data.profile ?? null
  } catch (e) {
    console.warn('[profile] fetch failed:', e)
    return null
  }
}
