// In-app Shop: replaces the old chat-only "/shop" command (see docs brief). Fetches the
// server-authoritative catalog (TelegramBot/shop.mjs), then opens Telegram's native Stars
// payment sheet via openInvoice() for whichever item the player taps - no price or grant logic
// lives here, this is presentation over what the server already decided.
import { useEffect, useState } from 'react'
import { createShopInvoice, fetchShopCatalog, type ShopItem } from '../../game/monetization/shopApi'
import { hapticAction, hapticSuccess, openInvoice } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { Sheet } from '../Sheet'

interface ShopSheetProps {
  open: boolean
  onClose: () => void
  apiBaseUrl: string | undefined
  /** Claims the purchase into the session right away instead of waiting for the next
   *  foreground/periodic check - see useGameSession's refreshPurchases. */
  refreshPurchases: () => Promise<void>
  /** Re-fetches owned cards + pending packs (GameShell's refreshCards) - a "buy_pack_*"
   *  purchase mints its pack server-side with nothing for refreshPurchases to apply, so the
   *  Cards tab needs its own nudge to notice it without waiting on the next visibility change. */
  refreshCards: () => void
}

const CATEGORY_ORDER: Array<{ kind: string; label: string }> = [
  { kind: 'bundle', label: 'STARTER OFFER' },
  { kind: 'currency', label: 'STARDUST' },
  { kind: 'cards', label: 'CARD PACKS' },
  { kind: 'boost', label: 'BOOSTS' },
  { kind: 'vip', label: 'VIP' },
]

export function ShopSheet({ open, onClose, apiBaseUrl, refreshPurchases, refreshCards }: ShopSheetProps) {
  const [items, setItems] = useState<ShopItem[]>([])
  const [purchased, setPurchased] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchShopCatalog(apiBaseUrl).then((catalog) => {
      setItems(catalog?.items ?? [])
      setPurchased(new Set(catalog?.purchased ?? []))
      setLoading(false)
    })
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apiBaseUrl])

  const handleBuy = async (item: ShopItem) => {
    setError(null)
    setBuyingId(item.id)
    audio.click()
    hapticAction()
    try {
      const url = await createShopInvoice(apiBaseUrl, item.id)
      if (!url) {
        setError("Couldn't start that purchase - try again in a moment.")
        return
      }
      const status = await openInvoice(url)
      if (status === 'paid') {
        hapticSuccess()
        await refreshPurchases()
        refreshCards() // no-op for currency items, picks up a bought pack for cards items
        load() // refreshes the `purchased` set for one-time items
      }
    } finally {
      setBuyingId(null)
    }
  }

  const groups = CATEGORY_ORDER.map((c) => ({ ...c, rows: items.filter((i) => i.kind === c.kind) })).filter((g) => g.rows.length > 0)

  return (
    <Sheet open={open} onClose={onClose} title="SHOP">
      {loading ? (
        <div className="cards-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="cards-empty">The shop is quiet right now - check back soon.</div>
      ) : (
        <div className="shop-list">
          {error && <div className="shop-error">{error}</div>}
          {groups.map((g) => (
            <div key={g.kind}>
              <div className="shop-category-header">{g.label}</div>
              {g.rows.map((item) => {
                const owned = item.oneTime && purchased.has(item.id)
                const buying = buyingId === item.id
                return (
                  <div key={item.id} className={`shop-row ${owned ? 'shop-row--owned' : ''}`}>
                    <div className="shop-row-body">
                      <div className="shop-row-title">{item.title}</div>
                      <div className="shop-row-desc">{item.description}</div>
                    </div>
                    <button className={`shop-row-buy ${owned ? '' : 'shop-row-buy--active'}`} disabled={owned || buying} onClick={() => handleBuy(item)}>
                      {owned ? 'OWNED' : buying ? '…' : `${item.priceStars}★`}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
