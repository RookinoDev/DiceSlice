// Hand-written types for rosterCardRules.mjs (shared with scripts/genCardPool.mjs - see the
// note at the top of that file for why it's plain ESM).
import type { CardRarity } from './catalog'

export interface RosterEntryLike {
  n: string
  c: string
  r?: number | null
  t?: number | null
  d?: number | null
  y?: number | null
  D?: number | null
  s?: string
  v?: number | null
}

export function slugForName(name: string): string
export function nameHash(s: string): number
export function classificationForEntry(e: RosterEntryLike): string
export function rarityForEntry(e: RosterEntryLike): CardRarity
