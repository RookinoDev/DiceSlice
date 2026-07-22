// Read-only client for the public leaderboard endpoint (TelegramBot/server.mjs GET
// /api/leaderboard). Same shape as profileApi.ts - plain fetch, no initData needed (the
// endpoint is deliberately public/unauthenticated), graceful empty result on any failure.
export type LeaderboardSortBy = 'deepestStage' | 'bossesDefeated' | 'prestigeCount' | 'deepestBossCleared'

export interface LeaderboardEntry {
  telegramUserId: number
  firstName: string | null
  username: string | null
  photoUrl: string | null
  value: number
}

export async function fetchLeaderboard(apiBaseUrl: string | undefined, sortBy: LeaderboardSortBy, limit = 50): Promise<LeaderboardEntry[]> {
  if (!apiBaseUrl) return []
  try {
    const res = await fetch(`${apiBaseUrl}/api/leaderboard?sortBy=${sortBy}&limit=${limit}`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.entries) ? data.entries : []
  } catch (e) {
    console.warn('[leaderboard] fetch failed:', e)
    return []
  }
}
