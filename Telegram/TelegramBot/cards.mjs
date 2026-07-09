// Card pack rules: pack types, drop tables, variants, pity, duplicate protection, and the
// server-side roll. The client only ever animates what these functions decide. Card
// ids/rarities come from cardPool.json, generated from the app catalog + roster rules
// (TelegramApp `npm run gen:cardpool`) so client and server always agree.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const CARD_POOL = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'cardPool.json'), 'utf8'))

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra']

/** Variant ids - mirror of TelegramApp src/game/cards/variants.ts (stored in DB rows). */
export const VARIANT_ORDER = ['standard', 'foil', 'holo', 'fullart', 'negative', 'polychrome']

/** When a card upgrades to a variant, which one (weighted; polychrome is the chase). */
export const VARIANT_WEIGHTS = { foil: 50, holo: 28, fullart: 12, negative: 7, polychrome: 3 }

/** Per-slot rarity weights (non-guaranteed slots). Published in-game - keep in sync with the UI. */
export const SLOT_WEIGHTS = { common: 55, uncommon: 25, rare: 12, epic: 5.5, legendary: 2, ultra: 0.5 }

/**
 * Boss-quality scaling: how strongly a pack's quality (0..1, from the boss stage that
 * earned it) tilts slot weights toward high tiers. At q=1 a common is ~2.4x less likely
 * and a legendary ~3x more likely than the published base table.
 */
export const QUALITY_TILT = { common: -0.58, uncommon: 0, rare: 0.6, epic: 1.2, legendary: 2.0, ultra: 2.0 }

/** Pack types. floor = slot-0 guaranteed minimum rarity; variantChance = per-card upgrade roll. */
export const PACK_TYPES = {
  meteor: { cards: 3, floor: 'uncommon', variantChance: 0.06 },
  stellar: { cards: 4, floor: 'rare', variantChance: 0.08 },
  deepsky: { cards: 5, floor: 'epic', variantChance: 0.1 },
  singularity: { cards: 5, floor: 'legendary', variantChance: 0.18 },
}

/** Pity: a forced floor after this many packs without hitting the tier naturally. */
export const PITY = { epic: 10, legendary: 30 }

/** New-card weighting: rerolls granted when a picked card is already owned (kept if all fail). */
export const NEW_CARD_REROLLS = 2

/** Dust refine value per rarity (duplicates convert to this; see refineValue for variants). */
export const REFINE_VALUE = { common: 5, uncommon: 15, rare: 40, epic: 100, legendary: 250, ultra: 600 }

/** Variant multiplier on refine value AND on craft cost (progression toward special variants). */
export const VARIANT_MULT = { standard: 1, foil: 2, holo: 4, fullart: 6, negative: 8, polychrome: 12 }

/** Crafting a chosen card costs this multiple of its refine value - deterministic bad-luck protection. */
export const CRAFT_COST_MULT = 4

const poolByRarity = new Map(RARITY_ORDER.map((r) => [r, CARD_POOL.filter((c) => c.rarity === r)]))

/** Deterministic RNG (mulberry32) - inject into rollPack for replayable/testable rolls. */
export function seededRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Which pack a boss at this stage drops (boss index within the 30-boss cycle). */
export function packTypeForBossStage(stage, bossInterval = 5) {
  const bossIndex = Math.max(1, Math.floor(stage / bossInterval))
  const cyclePos = ((bossIndex - 1) % 30) + 1 // 1..30
  if (cyclePos <= 10) return 'meteor' // giants
  if (cyclePos <= 20) return 'stellar' // stars
  if (cyclePos <= 28) return 'deepsky' // nebulae + galaxies
  return 'singularity' // black holes
}

/** Pack quality 0..1 from the stage that earned it - deeper runs earn richer packs. */
export function packQualityForStage(stage) {
  const s = Math.max(1, Number(stage) || 1)
  return Math.min(1, Math.log10(s) / 4) // stage 10 -> 0.25, 100 -> 0.5, 10000 -> 1
}

export function refineValue(rarity, variant) {
  return (REFINE_VALUE[rarity] ?? 0) * (VARIANT_MULT[variant] ?? 1)
}

export function craftCost(rarity, variant) {
  return refineValue(rarity, variant) * CRAFT_COST_MULT
}

function rollRarity(rng, minRarity, quality) {
  const minIdx = RARITY_ORDER.indexOf(minRarity)
  const entries = RARITY_ORDER.slice(minIdx).map((r) => [r, SLOT_WEIGHTS[r] * (1 + quality * (QUALITY_TILT[r] ?? 0))])
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [rarity, weight] of entries) {
    roll -= weight
    if (roll <= 0) return rarity
  }
  return entries[entries.length - 1][0]
}

/**
 * Pick a card of the given rarity. New-card weighting + limited duplicate protection:
 * a pick that's already owned (or already in this pack) gets NEW_CARD_REROLLS chances to
 * land on something fresh - then stands, so dupes stay possible and rare pulls stay tense.
 */
function pickCard(rng, rarity, ownedIds, packIds) {
  const pool = poolByRarity.get(rarity)
  let pick = pool[Math.floor(rng() * pool.length)]
  for (let i = 0; i < NEW_CARD_REROLLS && (ownedIds.has(pick.id) || packIds.has(pick.id)); i++) {
    pick = pool[Math.floor(rng() * pool.length)]
  }
  return pick
}

function rollVariant(rng, variantChance) {
  if (rng() >= variantChance) return 'standard'
  const entries = Object.entries(VARIANT_WEIGHTS)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [variant, weight] of entries) {
    roll -= weight
    if (roll <= 0) return variant
  }
  return 'foil'
}

const rarityAtLeast = (rarity, floor) => RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(floor)

/**
 * Rolls a pack's contents. Pure: rng is injectable (see seededRng) for deterministic rolls.
 *   pity = { sinceEpic, sinceLegendary } (packs since the tier last appeared)
 *   ownedIds = Set of card ids the player already owns (new-card weighting)
 *   quality = 0..1 boss-quality tilt (packQualityForStage)
 * Returns { cards: [{ cardId, rarity, variant }], pity: updated }.
 */
export function rollPack(packType, pity, ownedIds = new Set(), quality = 0, rng = Math.random) {
  const spec = PACK_TYPES[packType]
  if (!spec) throw new Error(`unknown pack type: ${packType}`)

  const cards = []
  const packIds = new Set()
  // Slot 0 carries the pack's guaranteed floor; the rest roll the open table.
  for (let i = 0; i < spec.cards; i++) {
    const rarity = rollRarity(rng, i === 0 ? spec.floor : 'common', quality)
    const card = pickCard(rng, rarity, ownedIds, packIds)
    packIds.add(card.id)
    cards.push({ cardId: card.id, rarity, variant: rollVariant(rng, spec.variantChance) })
  }

  // Pity floors: force-upgrade the last slot if a tier is overdue (checked worst-first).
  const next = { sinceEpic: pity.sinceEpic + 1, sinceLegendary: pity.sinceLegendary + 1 }
  if (next.sinceLegendary >= PITY.legendary && !cards.some((c) => rarityAtLeast(c.rarity, 'legendary'))) {
    const slot = cards.length - 1
    cards[slot] = { cardId: pickCard(rng, 'legendary', ownedIds, packIds).id, rarity: 'legendary', variant: cards[slot].variant }
  } else if (next.sinceEpic >= PITY.epic && !cards.some((c) => rarityAtLeast(c.rarity, 'epic'))) {
    const slot = cards.length - 1
    cards[slot] = { cardId: pickCard(rng, 'epic', ownedIds, packIds).id, rarity: 'epic', variant: cards[slot].variant }
  }

  if (cards.some((c) => rarityAtLeast(c.rarity, 'legendary'))) {
    next.sinceLegendary = 0
    next.sinceEpic = 0
  } else if (cards.some((c) => rarityAtLeast(c.rarity, 'epic'))) {
    next.sinceEpic = 0
  }

  return { cards, pity: next }
}
