// Profile card showcase: 5 ordered slots the player fills from their OWNED cards.
// Tap an empty slot to pick a card; tap a filled slot for inspect / move / replace / remove.
// Every change persists server-side immediately (the server re-validates ownership), so a
// visitor opening this profile sees the same showcase.
import { useMemo, useState } from 'react'
import type { CardDefinition } from '../../game/cards/catalog'
import { cardById } from '../../game/cards/generatedCards'
import { summarizeCollection } from '../../game/cards/collectionSummary'
import type { OwnedCard } from '../../game/cards/cardsApi'
import { saveShowcase } from '../../game/cards/cardsApi'
import type { ShowcaseEntry } from '../../game/profileApi'
import { VARIANT_LABEL } from '../../game/cards/variants'
import { RARITY_COLOR } from './cardTheme'
import { CardArt } from './CardArt'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticTap } from '../../telegram'
import type { CSSProperties } from 'react'

export const SHOWCASE_SLOTS = 5

interface ShowcaseEditorProps {
  apiBaseUrl: string | undefined
  ownedCards: OwnedCard[]
  showcase: ShowcaseEntry[]
  onChange: (next: ShowcaseEntry[]) => void
  onInspect: (card: CardDefinition) => void
}

export function ShowcaseEditor({ apiBaseUrl, ownedCards, showcase, onChange, onInspect }: ShowcaseEditorProps) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const summary = useMemo(() => summarizeCollection(ownedCards), [ownedCards])

  const commit = (next: ShowcaseEntry[]) => {
    onChange(next)
    void saveShowcase(apiBaseUrl, next) // fire-and-forget; server re-validates ownership
  }

  const entryAt = (i: number): ShowcaseEntry | null => showcase[i] ?? null

  const pickResults = useMemo(() => {
    if (!picking) return []
    const q = query.trim().toLowerCase()
    const out: Array<{ card: CardDefinition; entry: ShowcaseEntry }> = []
    for (const [cardId, s] of summary) {
      const card = cardById(cardId)
      if (!card) continue
      if (q && !card.name.toLowerCase().includes(q)) continue
      if (showcase.some((e) => e.cardId === cardId)) continue // one slot per base card
      out.push({ card, entry: { cardId, variant: s.bestVariant } })
      if (out.length >= 24) break
    }
    return out
  }, [picking, query, summary, showcase])

  const placeInSlot = (slot: number, entry: ShowcaseEntry) => {
    const next = [...showcase]
    next[slot] = entry
    // Collapse holes so order stays contiguous (slot array -> ordered list).
    commit(next.filter(Boolean).slice(0, SHOWCASE_SLOTS))
    setPicking(false)
    setActiveSlot(null)
    setQuery('')
    audio.purchase()
    hapticAction()
  }

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= showcase.length) return
    const next = [...showcase]
    ;[next[from], next[to]] = [next[to], next[from]]
    commit(next)
    setActiveSlot(to)
    audio.click()
    hapticTap()
  }

  const remove = (slot: number) => {
    commit(showcase.filter((_, i) => i !== slot))
    setActiveSlot(null)
    audio.click()
    hapticTap()
  }

  return (
    <div className="showcase">
      <div className="profile-section-label">CARD SHOWCASE</div>
      <div className="showcase-slots">
        {Array.from({ length: SHOWCASE_SLOTS }, (_, i) => {
          const entry = entryAt(i)
          const card = entry ? cardById(entry.cardId) : undefined
          return (
            <button
              key={i}
              className={`showcase-slot ${card ? `cf-${card.rarity}` : ''} ${activeSlot === i ? 'showcase-slot--active' : ''}`}
              style={card ? ({ '--rarity-color': RARITY_COLOR[card.rarity] } as CSSProperties) : undefined}
              onClick={() => {
                hapticTap()
                if (!entry) {
                  setActiveSlot(i)
                  setPicking(true)
                } else {
                  setActiveSlot(activeSlot === i ? null : i)
                  setPicking(false)
                }
              }}
            >
              {card && entry ? (
                <>
                  <CardArt cardName={card.name} mode="grid" className="showcase-slot-art" />
                  {entry.variant !== 'standard' && <div className="showcase-slot-variant">{VARIANT_LABEL[entry.variant]}</div>}
                </>
              ) : (
                <div className="showcase-slot-empty">+</div>
              )}
            </button>
          )
        })}
      </div>

      {activeSlot !== null && entryAt(activeSlot) && !picking && (
        <div className="showcase-actions">
          <button
            onClick={() => {
              const card = cardById(entryAt(activeSlot)!.cardId)
              if (card) onInspect(card)
            }}
          >
            INSPECT
          </button>
          <button disabled={activeSlot === 0} onClick={() => move(activeSlot, -1)}>
            ◀
          </button>
          <button disabled={activeSlot >= showcase.length - 1} onClick={() => move(activeSlot, 1)}>
            ▶
          </button>
          <button onClick={() => setPicking(true)}>REPLACE</button>
          <button onClick={() => remove(activeSlot)}>REMOVE</button>
        </div>
      )}

      {picking && activeSlot !== null && (
        <div className="showcase-picker">
          <input className="cards-search" type="search" placeholder="Search owned cards..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <div className="showcase-picker-list">
            {pickResults.length === 0 && <div className="cards-empty">No owned cards match.</div>}
            {pickResults.map(({ card, entry }) => (
              <button key={card.id} className="showcase-picker-item" onClick={() => placeInSlot(activeSlot, entry)}>
                <span className="showcase-picker-name" style={{ color: RARITY_COLOR[card.rarity] }}>
                  {card.name}
                </span>
                <span className="showcase-picker-meta">
                  {card.rarity.toUpperCase()}
                  {entry.variant !== 'standard' ? ` · ${VARIANT_LABEL[entry.variant].toUpperCase()}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Read-only showcase for visited profiles. */
export function ShowcaseView({ showcase, onInspect }: { showcase: ShowcaseEntry[]; onInspect: (card: CardDefinition) => void }) {
  if (showcase.length === 0) return null
  return (
    <div className="showcase">
      <div className="profile-section-label">CARD SHOWCASE</div>
      <div className="showcase-slots">
        {showcase.slice(0, SHOWCASE_SLOTS).map((entry, i) => {
          const card = cardById(entry.cardId)
          if (!card) return null
          return (
            <button key={i} className={`showcase-slot cf-${card.rarity}`} style={{ '--rarity-color': RARITY_COLOR[card.rarity] } as CSSProperties} onClick={() => onInspect(card)}>
              <CardArt cardName={card.name} mode="grid" className="showcase-slot-art" />
              {entry.variant !== 'standard' && <div className="showcase-slot-variant">{VARIANT_LABEL[entry.variant]}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
