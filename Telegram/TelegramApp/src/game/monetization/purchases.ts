// Talks to the claim-purchases endpoint added in TelegramBot/server.mjs, crediting any
// Telegram Stars purchases (see TelegramBot/index.mjs's /shop command) into the save.
import { BigNumber } from '../core/BigNumber'
import type { GameSession } from '../gameplay/GameSession'
import { getInitData } from '../../telegram'

export interface PurchaseGrant {
  item: string
}

// Item ids must match the invoice_payload passed to replyWithInvoice in TelegramBot/index.mjs.
// "buy_pack_<type>" items have no client-side effect - db.mjs's claimPurchases already minted
// the pack server-side (packs live entirely there, unlike currency). They're listed here as
// no-ops purely so applyGrants below doesn't log them as "unknown grant item"; the Cards tab
// picks the new pack up via its own existing refetch (see ShopSheet's refreshCards call).
const noopGrant = () => {}

const GRANT_EFFECTS: Record<string, (session: GameSession) => void> = {
  // The Starter Pack's Stellar Pack half is minted server-side by db.mjs's claimPurchases -
  // this only needs to apply the Stardust half, same split as every other bundle would use.
  starter_pack: (session) => session.wallet.add(new BigNumber(2000)),
  stardust_pack_500: (session) => session.wallet.add(new BigNumber(500)),
  stardust_pack_1500: (session) => session.wallet.add(new BigNumber(1500)),
  stardust_pack_5000: (session) => session.wallet.add(new BigNumber(5000)),
  buy_pack_meteor: noopGrant,
  buy_pack_stellar: noopGrant,
  buy_pack_deepsky: noopGrant,
  buy_pack_singularity: noopGrant,
  offline_cap_boost: (session) => {
    session.boosts.offlineCapBonusHours += 16
  },
  // Extends from the current expiry (never wastes remaining days on an early repurchase), not
  // from "now" - matches the description shown in the shop (see TelegramBot/shop.mjs).
  vip_pass_30d: (session) => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60
    const base = Math.max(nowSeconds, session.boosts.vipExpiresUnixSeconds)
    session.boosts.vipExpiresUnixSeconds = base + THIRTY_DAYS_SECONDS
  },
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
