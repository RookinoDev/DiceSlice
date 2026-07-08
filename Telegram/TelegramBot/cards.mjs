// Card pack rules: pack types, drop tables, pity, and the server-side roll.
// The client only ever animates what these functions decide. Card ids/rarities come
// from cardPool.json, generated from the app catalog (TelegramApp `npm run gen:cardpool`).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const CARD_POOL = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'cardPool.json'), 'utf8'))

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra']

/** Per-slot rarity weights (non-guaranteed slots). Published in-game - keep in sync with the UI. */
export const SLOT_WEIGHTS = { common: 55, uncommon: 25, rare: 12, epic: 5.5, legendary: 2, ultra: 0.5 }

/** Pack types, keyed to the boss-escalation bands in the roster (boss every 5 sectors, 30-boss cycle). */
export const PACK_TYPES = {
  meteor: { cards: 3, floor: 'uncommon', holoChance: 0.05 },
  stellar: { cards: 4, floor: 'rare', holoChance: 0.05 },
  deepsky: { cards: 5, floor: 'epic', holoChance: 0.05 },
  singularity: { cards: 5, floor: 'legendary', holoChance: 0.15 },
}

/** Pity: a forced floor after this many packs without hitting the tier naturally. */
export const PITY_EPIC_PACKS = 10
export const PITY_LEGENDARY_PACKS = 30

const poolByRarity = new Map(RARITY_ORDER.map((r) => [r, CARD_POOL.filter((c) => c.rarity === r)]))

/** Which pack a boss at this stage drops (boss index within the 30-boss cycle). */
export function packTypeForBossStage(stage, bossInterval = 5) {
  const bossIndex = Math.max(1, Math.floor(stage / bossInterval))
  const cyclePos = ((bossIndex - 1) % 30) + 1 // 1..30
  if (cyclePos <= 10) return 'meteor' // giants
  if (cyclePos <= 20) return 'stellar' // stars
  if (cyclePos <= 28) return 'deepsky' // nebulae + galaxies
  return 'singularity' // black holes
}

function rollRarity(rng, minRarity) {
  const minIdx = RARITY_ORDER.indexOf(minRarity)
  const entries = RARITY_ORDER.slice(minIdx).map((r) => [r, SLOT_WEIGHTS[r]])
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [rarity, weight] of entries) {
    roll -= weight
    if (roll <= 0) return rarity
  }
  return entries[entries.length - 1][0]
}

function pickCard(rng, rarity) {
  const pool = poolByRarity.get(rarity)
  return pool[Math.floor(rng() * pool.length)]
}

const rarityAtLeast = (rarity, floor) => RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(floor)

/**
 * Rolls a pack's contents. Pure: rng is injectable for tests.
 * pity = { sinceEpic, sinceLegendary } (packs since the tier last appeared).
 * Returns { cards: [{ cardId, rarity, holo }], pity: updated }.
 */
export function rollPack(packType, pity, rng = Math.random) {
  const spec = PACK_TYPES[packType]
  if (!spec) throw new Error(`unknown pack type: ${packType}`)

  const cards = []
  // Slot 0 carries the pack's guaranteed floor; the rest roll the open table.
  for (let i = 0; i < spec.cards; i++) {
    const rarity = rollRarity(rng, i === 0 ? spec.floor : 'common')
    cards.push({ cardId: pickCard(rng, rarity).id, rarity, holo: rng() < spec.holoChance })
  }

  // Pity floors: force-upgrade the weakest slot if a tier is overdue (checked worst-first).
  const next = { sinceEpic: pity.sinceEpic + 1, sinceLegendary: pity.sinceLegendary + 1 }
  if (next.sinceLegendary >= PITY_LEGENDARY_PACKS && !cards.some((c) => rarityAtLeast(c.rarity, 'legendary'))) {
    const slot = cards.length - 1
    cards[slot] = { cardId: pickCard(rng, 'legendary').id, rarity: 'legendary', holo: cards[slot].holo }
  } else if (next.sinceEpic >= PITY_EPIC_PACKS && !cards.some((c) => rarityAtLeast(c.rarity, 'epic'))) {
    const slot = cards.length - 1
    cards[slot] = { cardId: pickCard(rng, 'epic').id, rarity: 'epic', holo: cards[slot].holo }
  }

  if (cards.some((c) => rarityAtLeast(c.rarity, 'legendary'))) {
    next.sinceLegendary = 0
    next.sinceEpic = 0
  } else if (cards.some((c) => rarityAtLeast(c.rarity, 'epic'))) {
    next.sinceEpic = 0
  }

  return { cards, pity: next }
}
