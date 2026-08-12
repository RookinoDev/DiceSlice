// What's New: a hand-authored changelog shown once per update, the moment a returning player
// (not a brand-new install - see hasRealProgress in NewsSheet's caller) opens the game after it
// changed. Deliberately localStorage, not SaveState/server - a per-device "have you seen this"
// flag, not progression (same reasoning as cardPrefs.ts).
//
// To ship a new entry: add one to the TOP of NEWS_ENTRIES with a fresh, never-reused id (today's
// date is a good id). That's the whole process - nothing else to wire up.
export interface NewsEntry {
  id: string
  date: string
  title: string
  items: string[]
}

/** Newest first. */
export const NEWS_ENTRIES: NewsEntry[] = [
  {
    id: '2026-08-12',
    date: 'Aug 12, 2026',
    title: 'Duplicate Cards Level Up',
    items: [
      'Owning duplicates of a card now levels it up (2 copies = Lv 2, 4 = Lv 3, 8 = Lv 4, ...) - a leveled card is a stronger pick for a Talent Tree Gem Socket.',
      "Talent Points no longer cap out - a new Eternal Drive node keeps growing forever once every branch is fully mastered.",
      "Tap a Leaderboard row to view that player's profile and card showcase.",
      'Fixed a bug where Profile Showcase edits could silently fail to save.',
    ],
  },
]

const SEEN_KEY = 'stellarbreaker.news.lastSeenId.v1'

/** Every entry the player hasn't seen yet, newest first - empty if there's nothing new or
 *  localStorage is unavailable. */
export function unseenNewsEntries(): NewsEntry[] {
  let lastSeen: string | null = null
  try {
    lastSeen = localStorage.getItem(SEEN_KEY)
  } catch {
    return []
  }
  if (lastSeen === NEWS_ENTRIES[0]?.id) return []
  const idx = NEWS_ENTRIES.findIndex((e) => e.id === lastSeen)
  // Unknown/missing lastSeen (first time this system runs, or storage was cleared) - don't dump
  // the whole history on a returning player, just the latest entry.
  return idx === -1 ? NEWS_ENTRIES.slice(0, 1) : NEWS_ENTRIES.slice(0, idx)
}

export function markNewsSeen(): void {
  const latest = NEWS_ENTRIES[0]
  if (!latest) return
  try {
    localStorage.setItem(SEEN_KEY, latest.id)
  } catch {
    // best-effort - re-showing the same news once more next launch is harmless
  }
}
