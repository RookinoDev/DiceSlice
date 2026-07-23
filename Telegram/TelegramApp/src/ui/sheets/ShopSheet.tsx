// In-app Shop: replaces the old chat-only "/shop" command (see docs brief). Fetches the
// server-authoritative catalog (TelegramBot/shop.mjs), then opens Telegram's native Stars
// payment sheet via openInvoice() for whichever item the player taps - no price or grant logic
// lives here, this is presentation over what the server already decided.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createShopInvoice, fetchShopCatalog, type ShopItem } from '../../game/monetization/shopApi'
import { hapticAction, hapticSuccess, openInvoice } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import type { CardRarity } from '../../game/cards/catalog'
import type { PackType } from '../../game/cards/cardsApi'
import { RARITY_COLOR, RARITY_GEM } from '../cards/cardTheme'
import { CrownIcon, DailyGiftIcon, GoldIcon, HourglassIcon } from '../icons'
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

// Starter Pack renders separately as a featured hero card up top - not in this grouped list.
const CATEGORY_ORDER: Array<{ kind: string; label: string }> = [
  { kind: 'currency', label: 'STARDUST' },
  { kind: 'cards', label: 'CARD PACKS' },
  { kind: 'boost', label: 'BOOSTS' },
  { kind: 'vip', label: 'VIP' },
]

const PACK_TIER_RARITY: Record<PackType, CardRarity> = { meteor: 'uncommon', stellar: 'rare', deepsky: 'epic', singularity: 'legendary' }

// Real Stardust-per-Star rate of each bundle vs the Small pack (see TelegramBot/shop.mjs's
// actual listed amounts/prices: 500/25, 1500/60, 5000/175) - not made-up marketing numbers.
const STARDUST_BONUS_PERCENT: Record<string, number> = {
  stardust_pack_1500: 25,
  stardust_pack_5000: 43,
}

function packTypeOf(item: ShopItem): PackType | null {
  return item.id.startsWith('buy_pack_') ? (item.id.slice('buy_pack_'.length) as PackType) : null
}

function iconForItem(item: ShopItem): ReactNode {
  if (item.id === 'starter_pack') return <DailyGiftIcon color="#FFD873" size={28} />
  if (item.id === 'offline_cap_boost') return <HourglassIcon size={28} />
  if (item.id === 'vip_pass_30d') return <CrownIcon size={28} />
  const packType = packTypeOf(item)
  if (packType) return <img src={RARITY_GEM[PACK_TIER_RARITY[packType]]} alt="" className="shop-row-gem" />
  return <GoldIcon size={26} />
}

/** Accent color used for the row's icon-well glow and border - reuses the same rarity palette
 *  card packs already use elsewhere, so a Deep Sky pack reads "epic" here too. */
function glowColorForItem(item: ShopItem): string {
  if (item.id === 'starter_pack') return '#FFD873'
  if (item.id === 'offline_cap_boost') return '#43DDEE'
  if (item.id === 'vip_pass_30d') return '#FFB238'
  const packType = packTypeOf(item)
  if (packType) return RARITY_COLOR[PACK_TIER_RARITY[packType]]
  return '#FFB238'
}

export function ShopSheet({ open, onClose, apiBaseUrl, refreshPurchases, refreshCards }: ShopSheetProps) {
  const [items, setItems] = useState<ShopItem[]>([])
  const [purchased, setPurchased] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Post-purchase celebration: which row just landed + a key bump so its icon replays its
  // pop-in animation even if the same item is bought again later (VIP is repeatable).
  const [justBoughtId, setJustBoughtId] = useState<string | null>(null)
  const [celebrateKey, setCelebrateKey] = useState(0)

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
        audio.purchase()
        setJustBoughtId(item.id)
        setCelebrateKey((k) => k + 1)
        setTimeout(() => setJustBoughtId(null), 1400)
        await refreshPurchases()
        refreshCards() // no-op for currency items, picks up a bought pack for cards items
        load() // refreshes the `purchased` set for one-time items
      }
    } finally {
      setBuyingId(null)
    }
  }

  const starterItem = items.find((i) => i.id === 'starter_pack')
  const starterOwned = starterItem ? starterItem.oneTime && purchased.has(starterItem.id) : false
  const groups = CATEGORY_ORDER.map((c) => ({ ...c, rows: items.filter((i) => i.kind === c.kind) })).filter((g) => g.rows.length > 0)

  const renderRow = (item: ShopItem, featured: boolean) => {
    const owned = item.oneTime && purchased.has(item.id)
    const buying = buyingId === item.id
    const justBought = justBoughtId === item.id
    const bonus = STARDUST_BONUS_PERCENT[item.id]
    const glow = glowColorForItem(item)
    return (
      <div
        key={item.id}
        className={`shop-row ${featured ? 'shop-row--featured' : ''} ${owned ? 'shop-row--owned' : ''} ${justBought ? 'shop-row--celebrate' : ''}`}
        style={{ '--shop-glow': glow } as CSSProperties}
      >
        {featured && <div className="shop-featured-ribbon">BEST VALUE</div>}
        <div key={justBought ? celebrateKey : 'idle'} className="shop-row-icon-well">
          {iconForItem(item)}
        </div>
        <div className="shop-row-body">
          <div className="shop-row-title">
            {item.title}
            {bonus !== undefined && <span className="shop-bonus-badge">+{bonus}% VALUE</span>}
          </div>
          <div className="shop-row-desc">{item.description}</div>
        </div>
        <button className={`shop-row-buy ${owned ? '' : 'shop-row-buy--active'}`} disabled={owned || buying} onClick={() => handleBuy(item)}>
          {owned ? (
            'OWNED'
          ) : buying ? (
            '…'
          ) : (
            <>
              <span className="shop-row-price-star">★</span>
              {item.priceStars}
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="SHOP">
      {loading ? (
        <div className="cards-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="cards-empty">The shop is quiet right now - check back soon.</div>
      ) : (
        <div className="shop-list">
          {error && <div className="shop-error">{error}</div>}
          {starterItem && !starterOwned && renderRow(starterItem, true)}
          {groups.map((g) => (
            <div key={g.kind}>
              <div className="shop-category-header">{g.label}</div>
              {g.rows.map((item) => renderRow(item, false))}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
