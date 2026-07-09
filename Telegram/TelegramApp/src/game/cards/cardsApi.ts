// Client for the card pack/collection endpoints (TelegramBot/server.mjs + db.mjs). The server
// rolls every pack and mints every serial - this client only asks it to do so and reports the
// result; never compute rarity/serials locally. See docs/CARD_SYSTEM_PLAN.md.
import { getInitData } from '../../telegram'
import type { CardRarity } from './catalog'

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
  holo: boolean
  serial: number
}

export interface OpenPackResult {
  packType: PackType
  cards: MintedCard[]
}

export interface OwnedCard {
  cardId: string
  holo: boolean
  serial: number
  mintedAtMs: number
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

export async function fetchPendingPacks(apiBaseUrl: string | undefined): Promise<PendingPack[]> {
  const data = await postJson<{ packs: Array<{ id: number; type: PackType; created_at: number }> }>(apiBaseUrl, '/api/packs', {})
  if (!data) return []
  return data.packs.map((p) => ({ id: p.id, type: p.type, createdAtMs: p.created_at }))
}

/** Opens one pack server-side. Returns null on any failure (network, already-opened, not owned) - the caller should treat that as "nothing happened", never partial success. */
export async function openPackRequest(apiBaseUrl: string | undefined, packId: number): Promise<OpenPackResult | null> {
  return postJson<OpenPackResult>(apiBaseUrl, '/api/packs/open', { packId })
}

export async function fetchCollection(apiBaseUrl: string | undefined): Promise<OwnedCard[]> {
  const data = await postJson<{ cards: Array<{ card_id: string; holo: number; serial: number; minted_at: number }> }>(apiBaseUrl, '/api/collection', {})
  if (!data) return []
  return data.cards.map((c) => ({ cardId: c.card_id, holo: c.holo === 1, serial: c.serial, mintedAtMs: c.minted_at }))
}

export const PACK_LABEL: Record<PackType, string> = {
  meteor: 'METEOR PACK',
  stellar: 'STELLAR PACK',
  deepsky: 'DEEP SKY PACK',
  singularity: 'SINGULARITY PACK',
}
