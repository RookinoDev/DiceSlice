// DEV-ONLY mock collection for browser-preview work outside Telegram (no initData = no real
// API). Referenced behind `import.meta.env.DEV` checks in cardsApi.ts, so production builds
// eliminate this module entirely at compile time - unlike a hand-edited stub, it can never
// ship by accident (the lesson from the Phase 2 TEMP-TEST-STUB incident).
import type { OpenPackResult, OwnedCard, PendingPack } from './cardsApi'
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

/** A plausible singularity-style pull covering the ceremony's paths (legendary, variant, new). */
export function mockOpenPack(packId: number): OpenPackResult {
  const pick = (i: number) => FULL_CATALOG[(packId * 97 + i * 131) % FULL_CATALOG.length]
  return {
    packType: packId % 2 === 0 ? 'singularity' : 'meteor',
    cards: [
      { cardId: pick(1).id, rarity: pick(1).rarity, variant: 'standard', serial: 12, isNew: false },
      { cardId: pick(2).id, rarity: pick(2).rarity, variant: 'foil', serial: 4, isNew: true },
      { cardId: pick(3).id, rarity: pick(3).rarity, variant: 'standard', serial: 731, isNew: true },
      { cardId: 'betelgeuse', rarity: 'legendary', variant: 'holo', serial: 42, isNew: true },
      { cardId: pick(5).id, rarity: pick(5).rarity, variant: 'polychrome', serial: 7, isNew: false },
    ],
  }
}
