// Collection UI preferences: favorites and recently-viewed cards. Deliberately localStorage,
// NOT the server or SaveState - these are per-device display prefs, not ownership/progression
// (the save rule: only ownership and progression data is persisted server-side).

const FAVORITES_KEY = 'stellarbreaker.cards.favorites.v1'
const RECENT_KEY = 'stellarbreaker.cards.recent.v1'
const RECENT_MAX = 30

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // best-effort - prefs loss is acceptable, never blocks the UI
  }
}

export function loadFavorites(): Set<string> {
  return new Set(readIds(FAVORITES_KEY))
}

/** Returns the new favorite state for the card. */
export function toggleFavorite(cardId: string): boolean {
  const favs = loadFavorites()
  const nowFav = !favs.has(cardId)
  if (nowFav) favs.add(cardId)
  else favs.delete(cardId)
  writeIds(FAVORITES_KEY, [...favs])
  return nowFav
}

/** Most-recently-viewed first, capped. */
export function loadRecentViews(): string[] {
  return readIds(RECENT_KEY)
}

export function recordCardView(cardId: string): void {
  const recent = loadRecentViews().filter((id) => id !== cardId)
  recent.unshift(cardId)
  writeIds(RECENT_KEY, recent.slice(0, RECENT_MAX))
}
