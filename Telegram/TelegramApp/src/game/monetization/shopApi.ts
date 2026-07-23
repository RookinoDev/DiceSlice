// Client for the in-app Shop (TelegramBot/server.mjs POST /api/shop/items + /api/shop/invoice,
// catalog defined in TelegramBot/shop.mjs). Price and description are server-authoritative -
// this module never invents or overrides either, it only renders what the server returns and
// asks for an invoice link by item id.
import { getInitData } from '../../telegram'

export interface ShopItem {
  id: string
  title: string
  description: string
  priceStars: number
  kind: string
  oneTime: boolean
}

export interface ShopCatalog {
  items: ShopItem[]
  /** One-time item ids this player has already bought (claimed or not). */
  purchased: string[]
}

export async function fetchShopCatalog(apiBaseUrl: string | undefined): Promise<ShopCatalog | null> {
  const initData = getInitData()
  if (!apiBaseUrl || !initData) return null
  try {
    const res = await fetch(`${apiBaseUrl}/api/shop/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.warn('[shop] catalog fetch failed:', e)
    return null
  }
}

/** Requests a fresh Telegram Stars invoice link for `itemId`. Null on any failure (network,
 *  unknown item, or a one-time item already owned - the caller shows a generic error either way,
 *  since the catalog's `purchased` list is the source of truth for graying the button out). */
export async function createShopInvoice(apiBaseUrl: string | undefined, itemId: string): Promise<string | null> {
  const initData = getInitData()
  if (!apiBaseUrl || !initData) return null
  try {
    const res = await fetch(`${apiBaseUrl}/api/shop/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, itemId }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.url === 'string' ? data.url : null
  } catch (e) {
    console.warn('[shop] invoice request failed:', e)
    return null
  }
}
