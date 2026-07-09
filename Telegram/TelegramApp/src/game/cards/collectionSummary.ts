// Groups raw owned-card instances (one row per serial) into a per-cardId summary for display.
// Pure data logic, kept out of the UI components that use it so they stay fast-refresh-clean
// (a component file that also exports plain functions/types breaks React's fast refresh).
import type { OwnedCard } from './cardsApi'

export interface OwnedSummary {
  count: number
  hasHolo: boolean
  /** Lowest serial owned - the earliest, most collector-prestigious mint of this card the player holds. */
  bestSerial: number
}

export function summarizeCollection(ownedCards: OwnedCard[]): Map<string, OwnedSummary> {
  const map = new Map<string, OwnedSummary>()
  for (const c of ownedCards) {
    const existing = map.get(c.cardId)
    if (existing) {
      existing.count++
      existing.hasHolo = existing.hasHolo || c.holo
      existing.bestSerial = Math.min(existing.bestSerial, c.serial)
    } else {
      map.set(c.cardId, { count: 1, hasHolo: c.holo, bestSerial: c.serial })
    }
  }
  return map
}
