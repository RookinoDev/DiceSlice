// DEV-ONLY mock collection for browser-preview work outside Telegram (no initData = no real
// API). Referenced behind `import.meta.env.DEV` checks in cardsApi.ts, so production builds
// eliminate this module entirely at compile time - unlike a hand-edited stub, it can never
// ship by accident (the lesson from the Phase 2 TEMP-TEST-STUB incident).
import type { OwnedCard, PendingPack } from './cardsApi'
import { FULL_CATALOG } from './generatedCards'
import { VARIANT_ORDER } from './variants'
import { nameHash } from './rosterCardRules.mjs'

/** ~2,600 owned instances across ~2,000 base cards - enough to prove the virtualized grid. */
export function mockCollection(): { cards: OwnedCard[]; dust: number } {
  const cards: OwnedCard[] = []
  let instanceId = 1
  for (let i = 0; i < FULL_CATALOG.length; i += 3) {
    const def = FULL_CATALOG[i]
    const h = nameHash(def.id)
    const copies = h % 10 === 0 ? 3 : h % 4 === 0 ? 2 : 1
    for (let c = 0; c < copies; c++) {
      cards.push({
        instanceId: instanceId++,
        cardId: def.id,
        variant: VARIANT_ORDER[(h >> (c * 3)) % 16 < 11 ? 0 : ((h >> (c * 3)) % 5) + 1],
        serial: (h % 900) + c + 1,
        mintedAtMs: Date.now() - (h % 90) * 86400000 + c * 1000,
      })
    }
  }
  return { cards, dust: 1234 }
}

export function mockPacks(): PendingPack[] {
  return [
    { id: 9001, type: 'meteor', createdAtMs: Date.now() },
    { id: 9002, type: 'singularity', createdAtMs: Date.now() },
  ]
}
