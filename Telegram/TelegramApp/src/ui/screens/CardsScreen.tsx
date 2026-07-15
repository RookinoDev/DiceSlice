// The collection: OWNED CARDS ONLY (no ghosts/silhouettes/locked slots, ever), virtualized
// so thousands of owned cards scroll at 60fps. Search / filter / sort run over the owned
// summary (not the 5,890-card catalog), so they stay O(owned). GameShell owns fetching.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CardDefinition, CardRarity } from '../../game/cards/catalog'
import { cardById, FULL_CATALOG } from '../../game/cards/generatedCards'
import type { OwnedCard } from '../../game/cards/cardsApi'
import { summarizeCollection, type OwnedSummary } from '../../game/cards/collectionSummary'
import { loadFavorites, loadRecentViews } from '../../game/cards/cardPrefs'
import { CardGridItem } from '../cards/CardGridItem'

const COLUMNS = 3
/** Must match .card-grid-row height (cell + gap) in ui.css. */
const ROW_HEIGHT_PX = 148
const OVERSCAN_ROWS = 3

const RARITY_FILTERS: Array<CardRarity | 'all'> = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra']

type SortMode = 'number' | 'rarity' | 'newest' | 'name' | 'count' | 'recent'
const SORT_LABEL: Record<SortMode, string> = { number: 'Nº', rarity: 'RARITY', newest: 'NEWEST', name: 'A-Z', count: 'DUPES', recent: 'RECENT' }
const RARITY_RANK: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, ultra: 5 }

interface CardsScreenProps {
  ownedCards: OwnedCard[]
  dust: number
  pendingPackCount: number
  onSelectCard: (card: CardDefinition, list: CardDefinition[]) => void
  onOpenPacks: () => void
}

interface Entry {
  card: CardDefinition
  owned: OwnedSummary
}

export function CardsScreen({ ownedCards, dust, pendingPackCount, onSelectCard, onOpenPacks }: CardsScreenProps) {
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState<CardRarity | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('number')

  // Read fresh every render (not memoized): favoriting happens in a sibling sheet
  // (CardDetailSheet), and this is a small localStorage array - parsing it is cheap
  // enough that a stale cache would cost more than just re-reading it.
  const favorites = loadFavorites()

  const summary = useMemo(() => summarizeCollection(ownedCards), [ownedCards])
  // Recency rank for the RECENT sort: lower index = viewed more recently. Cards never opened
  // sink to the bottom (Infinity), same recompute-per-render reasoning as favorites above.
  const recentRank = sort === 'recent' ? new Map(loadRecentViews().map((id, i) => [id, i])) : null

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase()
    const out: Entry[] = []
    for (const [cardId, owned] of summary) {
      const card = cardById(cardId)
      if (!card) continue // unknown id from a newer catalog version - hide rather than crash
      if (q && !card.name.toLowerCase().includes(q)) continue
      if (rarity !== 'all' && card.rarity !== rarity) continue
      out.push({ card, owned })
    }
    switch (sort) {
      case 'number':
        out.sort((a, b) => a.card.no - b.card.no)
        break
      case 'rarity':
        out.sort((a, b) => RARITY_RANK[b.card.rarity] - RARITY_RANK[a.card.rarity] || a.card.no - b.card.no)
        break
      case 'newest':
        out.sort((a, b) => b.owned.newestMintedAtMs - a.owned.newestMintedAtMs)
        break
      case 'name':
        out.sort((a, b) => a.card.name.localeCompare(b.card.name))
        break
      case 'count':
        out.sort((a, b) => b.owned.count - a.owned.count || a.card.no - b.card.no)
        break
      case 'recent':
        out.sort((a, b) => (recentRank?.get(a.card.id) ?? Infinity) - (recentRank?.get(b.card.id) ?? Infinity) || a.card.no - b.card.no)
        break
    }
    return out
  }, [summary, query, rarity, sort, recentRank])

  // --- Virtualization: fixed-height rows of COLUMNS cells inside an internal scroller.
  // Only visible rows (+overscan) mount; React key = rowIndex reuses the same row elements
  // while scrolling, which is the DOM-pooling behavior a 6,000-card collection needs.
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(400)

  const hasEntries = entries.length > 0
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setViewportH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasEntries])

  const rowCount = Math.ceil(entries.length / COLUMNS)
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS)
  const lastRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT_PX) + OVERSCAN_ROWS)

  const visibleRows: Array<{ rowIndex: number; items: Entry[] }> = []
  for (let r = firstRow; r <= lastRow; r++) {
    visibleRows.push({ rowIndex: r, items: entries.slice(r * COLUMNS, r * COLUMNS + COLUMNS) })
  }

  const chip = (active: boolean) => `cards-filter-chip ${active ? 'cards-filter-chip--active' : ''}`

  return (
    <div className="screen cards-screen">
      <div className="screen-header">
        <div>
          <div className="screen-title">COLLECTION</div>
          <div className="screen-subtitle">
            {summary.size} / {FULL_CATALOG.length} · {ownedCards.length} cards · ✦ {dust.toLocaleString()} dust
          </div>
        </div>
        <button
          className={`cards-open-packs-btn ${pendingPackCount === 0 ? 'cards-open-packs-btn--disabled' : ''}`}
          disabled={pendingPackCount === 0}
          onClick={onOpenPacks}
        >
          OPEN PACKS <span className="cards-open-packs-count">{pendingPackCount}</span>
        </button>
      </div>

      <input className="cards-search" type="search" placeholder="Search your cards..." value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="cards-filter-row">
        {RARITY_FILTERS.map((r) => (
          <button key={r} className={chip(rarity === r)} onClick={() => setRarity(r)}>
            {r === 'all' ? 'ALL' : r.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="cards-filter-row">
        {(['number', 'rarity', 'newest', 'recent', 'name', 'count'] as SortMode[]).map((s) => (
          <button key={s} className={chip(sort === s)} onClick={() => setSort(s)}>
            {SORT_LABEL[s]}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="cards-empty">
          {ownedCards.length === 0 ? 'Destroy bosses to earn card packs - your collection starts there.' : 'No cards match these filters.'}
        </div>
      ) : (
        <div ref={viewportRef} className="card-grid-viewport" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
          <div className="card-grid-spacer" style={{ height: rowCount * ROW_HEIGHT_PX }}>
            {visibleRows.map(({ rowIndex, items }) => (
              <div key={rowIndex} className="card-grid-row" style={{ transform: `translateY(${rowIndex * ROW_HEIGHT_PX}px)` }}>
                {items.map(({ card, owned }) => (
                  <CardGridItem
                    key={card.id}
                    card={card}
                    owned={owned}
                    setTotal={FULL_CATALOG.length}
                    favorite={favorites.has(card.id)}
                    onSelect={() => onSelectCard(card, entries.map((e) => e.card))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
