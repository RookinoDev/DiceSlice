// DEV-ONLY mock collection for browser-preview work outside Telegram (no initData = no real
// API). Referenced behind `import.meta.env.DEV` checks in cardsApi.ts, so production builds
// eliminate this module entirely at compile time - unlike a hand-edited stub, it can never
// ship by accident (the lesson from the Phase 2 TEMP-TEST-STUB incident).
import type { CollectionResult, GemSocketAssignment, OpenPackResult, OwnedCard, PendingPack } from './cardsApi'
import { FULL_CATALOG } from './generatedCards'
import { VARIANT_ORDER } from './variants'
import { nameHash } from './rosterCardRules.mjs'
import type { ShopCatalog } from '../monetization/shopApi'

/** ~2,600 owned instances across ~2,000 base cards - enough to prove the virtualized grid. A
 *  couple of gem sockets are pre-filled so the Talent Tree's socket UI has something to show
 *  in dev preview without needing to buy a gem node first. */
export function mockCollection(): CollectionResult {
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
  const gemSockets: GemSocketAssignment[] = [
    { nodeId: 'assault-gem-1', cardId: 'earth', variant: 'standard' },
    { nodeId: 'armada-gem-1', cardId: 'jupiter', variant: 'standard' },
  ]
  return { cards, dust: 1234, gemSockets }
}

export function mockPacks(): PendingPack[] {
  return [
    { id: 9001, type: 'meteor', createdAtMs: Date.now() },
    { id: 9002, type: 'singularity', createdAtMs: Date.now() },
  ]
}

/** Mirrors TelegramBot/shop.mjs's real SHOP_ITEMS (kept in sync by hand, same spirit as
 *  mockCollection() above) - lets the Shop redesign actually be seen in browser-preview work,
 *  since shopApi.ts otherwise has no dev fallback (no initData = no real API = an empty shop). */
export function mockShopCatalog(): ShopCatalog {
  return {
    items: [
      { id: 'starter_pack', title: 'Starter Offer', description: '2,000 Stardust + 1 Stellar Pack - one-time, well under buying them apart.', priceStars: 39, kind: 'bundle', oneTime: true },
      { id: 'stardust_pack_500', title: 'Small Stardust Pack', description: '500 bonus Stardust.', priceStars: 25, kind: 'currency', oneTime: false },
      { id: 'stardust_pack_1500', title: 'Medium Stardust Pack', description: '1,500 bonus Stardust - better value than the Small pack.', priceStars: 60, kind: 'currency', oneTime: false },
      { id: 'stardust_pack_5000', title: 'Large Stardust Pack', description: '5,000 bonus Stardust - best value of the three.', priceStars: 175, kind: 'currency', oneTime: false },
      { id: 'buy_pack_meteor', title: 'Meteor Pack', description: 'Mostly 1 card, sometimes a bonus haul of up to 5. At least one uncommon or better.', priceStars: 20, kind: 'cards', oneTime: false },
      { id: 'buy_pack_stellar', title: 'Stellar Pack', description: '4 cards. At least one rare or better.', priceStars: 45, kind: 'cards', oneTime: false },
      { id: 'buy_pack_deepsky', title: 'Deep Sky Pack', description: '5 cards. At least one epic or better.', priceStars: 90, kind: 'cards', oneTime: false },
      { id: 'buy_pack_nebula', title: 'Nebula Bundle', description: '8 cards. At least one rare or better - the biggest haul in the shop.', priceStars: 140, kind: 'cards', oneTime: false, tag: 'NEW' },
      { id: 'buy_pack_epicvault', title: 'Epic Vault', description: '3 cards, every single one epic or better. No commons, ever.', priceStars: 150, kind: 'cards', oneTime: false, tag: 'NEW' },
      { id: 'buy_pack_singularity', title: 'Singularity Pack', description: '5 cards. At least one legendary or better.', priceStars: 200, kind: 'cards', oneTime: false },
      { id: 'buy_pack_legendarycache', title: 'Legendary Cache', description: '4 cards: 1 guaranteed legendary, the rest epic or better. The rarest offer in the shop.', priceStars: 260, kind: 'cards', oneTime: false, tag: 'NEW' },
      { id: 'offline_cap_boost', title: 'Offline Cap Extender', description: 'Permanently raises the offline earnings cap from 8h to 24h.', priceStars: 45, kind: 'boost', oneTime: true },
      { id: 'talent_reset', title: 'Talent Reset', description: 'Refunds every Talent Point you have spent so you can rebuild your tree from scratch. Eternal Drive perks are kept.', priceStars: 60, kind: 'boost', oneTime: false },
      { id: 'vip_pass_30d', title: 'VIP Pass (30 days)', description: '+25% Stardust from every kill for 30 days. Repurchasing extends your remaining time.', priceStars: 99, kind: 'vip', oneTime: false },
    ],
    purchased: [],
  }
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
