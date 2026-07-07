// Talks to the claim-purchases endpoint added in TelegramBot/server.mjs, crediting any
// Telegram Stars purchases (see TelegramBot/index.mjs's /shop command) into the save.
import { BigNumber } from '../core/BigNumber'
import type { GameSession } from '../gameplay/GameSession'
import { getInitData } from '../../telegram'

export interface PurchaseGrant {
  item: string
}

// Item ids must match the invoice_payload passed to replyWithInvoice in TelegramBot/index.mjs.
const GRANT_EFFECTS: Record<string, (session: GameSession) => void> = {
  stardust_pack_500: (session) => session.wallet.add(new BigNumber(500)),
}

export async function claimPendingPurchases(apiBaseUrl: string): Promise<PurchaseGrant[]> {
  const initData = getInitData()
  if (!initData || !apiBaseUrl) return []

  try {
    const res = await fetch(`${apiBaseUrl}/api/claim-purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.grants) ? data.grants : []
  } catch (e) {
    console.warn('[purchases] claim request failed:', e)
    return []
  }
}

/** Applies each grant's effect to the session. Unknown item ids are ignored (forward-compatible). */
export function applyGrants(session: GameSession, grants: PurchaseGrant[]): void {
  for (const grant of grants) {
    const effect = GRANT_EFFECTS[grant.item]
    if (effect) effect(session)
    else console.warn('[purchases] unknown grant item:', grant.item)
  }
}
