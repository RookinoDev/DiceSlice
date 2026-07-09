// Groups raw owned-card instances (one row per serial) into a per-cardId summary for display.
// Pure data logic, kept out of the UI components that use it so they stay fast-refresh-clean
// (a component file that also exports plain functions/types breaks React's fast refresh).
import type { OwnedCard } from './cardsApi'
import { variantRank, type CardVariant } from './variants'

export interface OwnedSummary {
  /** Total instances owned of this base card (all variants) - the duplicate count. */
  count: number
  /** Instances per variant actually owned (missing key = none). */
  variants: Partial<Record<CardVariant, number>>
  /** Highest-prestige variant owned (drives the grid cell's effect tier). */
  bestVariant: CardVariant
  /** Lowest serial owned - the earliest, most collector-prestigious mint of this card the player holds. */
  bestSerial: number
  /** Most recent mint timestamp - powers the "recent" sort. */
  newestMintedAtMs: number
}

export function summarizeCollection(ownedCards: OwnedCard[]): Map<string, OwnedSummary> {
  const map = new Map<string, OwnedSummary>()
  for (const c of ownedCards) {
    const existing = map.get(c.cardId)
    if (existing) {
      existing.count++
      existing.variants[c.variant] = (existing.variants[c.variant] ?? 0) + 1
      if (variantRank(c.variant) > variantRank(existing.bestVariant)) existing.bestVariant = c.variant
      existing.bestSerial = Math.min(existing.bestSerial, c.serial)
      existing.newestMintedAtMs = Math.max(existing.newestMintedAtMs, c.mintedAtMs)
    } else {
      map.set(c.cardId, {
        count: 1,
        variants: { [c.variant]: 1 },
        bestVariant: c.variant,
        bestSerial: c.serial,
        newestMintedAtMs: c.mintedAtMs,
      })
    }
  }
  return map
}
