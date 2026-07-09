// Client for the card pack/collection endpoints (TelegramBot/server.mjs + db.mjs). The server
// rolls every pack and mints every serial - this client only asks it to do so and reports the
// result; never compute rarity/serials locally. See docs/CARD_SYSTEM_PLAN.md.
import { getInitData } from '../../telegram'
import type { CardRarity } from './catalog'
import type { CardVariant } from './variants'

const FETCH_TIMEOUT_MS = 6000

export type PackType = 'meteor' | 'stellar' | 'deepsky' | 'singularity'

export interface PendingPack {
  id: number
  type: PackType
  createdAtMs: number
}

export interface MintedCard {
  cardId: string
  rarity: CardRarity
  variant: CardVariant
  serial: number
  /** First copy of this base card the player has ever owned (server-computed). */
  isNew: boolean
}

export interface OpenPackResult {
  packType: PackType
  cards: MintedCard[]
}

export interface OwnedCard {
  /** Server instance id - the handle for refine operations. */
  instanceId: number
  cardId: string
  variant: CardVariant
  serial: number
  mintedAtMs: number
}

export interface CollectionResult {
  cards: OwnedCard[]
  /** Prism Dust balance (duplicate-refine currency). */
  dust: number
}

async function postJson<T>(apiBaseUrl: string | undefined, path: string, body: Record<string, unknown>): Promise<T | null> {
  const initData = getInitData()
  if (!initData || !apiBaseUrl) return null
  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, ...body }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (e) {
    console.warn(`[cards] ${path} failed:`, e)
    return null
  }
}

/** True in dev-preview outside Telegram: no initData means no real API - serve the DEV mock. */
function useDevMock(): boolean {
  return import.meta.env.DEV && !getInitData()
}

export async function fetchPendingPacks(apiBaseUrl: string | undefined): Promise<PendingPack[]> {
  if (useDevMock()) return (await import('./devMock')).mockPacks()
  const data = await postJson<{ packs: Array<{ id: number; type: PackType; created_at: number }> }>(apiBaseUrl, '/api/packs', {})
  if (!data) return []
  return data.packs.map((p) => ({ id: p.id, type: p.type, createdAtMs: p.created_at }))
}

export async function openPackRequest(apiBaseUrl: string | undefined, packId: number): Promise<OpenPackResult | null> {
  return postJson<OpenPackResult>(apiBaseUrl, '/api/packs/open', { packId })
}

export async function fetchCollection(apiBaseUrl: string | undefined): Promise<CollectionResult> {
  if (useDevMock()) return (await import('./devMock')).mockCollection()
  const data = await postJson<{ cards: Array<{ id: number; card_id: string; variant: CardVariant; serial: number; minted_at: number }>; dust: number }>(
    apiBaseUrl,
    '/api/collection',
    {},
  )
  if (!data) return { cards: [], dust: 0 }
  return {
    cards: data.cards.map((c) => ({ instanceId: c.id, cardId: c.card_id, variant: c.variant, serial: c.serial, mintedAtMs: c.minted_at })),
    dust: data.dust ?? 0,
  }
}

/** Refine (destroy) duplicate instances into dust. Server enforces the dupes-only rule. */
export async function refineCards(apiBaseUrl: string | undefined, instanceIds: number[]): Promise<{ refined: number; gained: number; dust: number } | null> {
  return postJson(apiBaseUrl, '/api/cards/refine', { instanceIds })
}

/** Craft a chosen card + variant for dust (bad-luck protection / variant progression). */
export async function craftCardRequest(
  apiBaseUrl: string | undefined,
  cardId: string,
  variant: CardVariant,
): Promise<{ cardId: string; rarity: CardRarity; variant: CardVariant; serial: number; cost: number; dust: number } | null> {
  return postJson(apiBaseUrl, '/api/cards/craft', { cardId, variant })
}

/** Persist the profile showcase (ordered owned cardId+variant pairs, max 8). */
export async function saveShowcase(apiBaseUrl: string | undefined, cards: Array<{ cardId: string; variant: CardVariant }>): Promise<boolean> {
  const res = await postJson<{ ok: boolean }>(apiBaseUrl, '/api/showcase', { cards })
  return res?.ok === true
}

export const PACK_LABEL: Record<PackType, string> = {
  meteor: 'METEOR PACK',
  stellar: 'STELLAR PACK',
  deepsky: 'DEEP SKY PACK',
  singularity: 'SINGULARITY PACK',
}
