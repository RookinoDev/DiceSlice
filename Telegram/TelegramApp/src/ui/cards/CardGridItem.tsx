// One collection grid cell. Owned-only by design: the collection never renders ghosts,
// silhouettes, or locked placeholders - a card exists in the UI only once you own it.
// memo()d: rows remount constantly while the virtualized grid scrolls, but a given card's
// props only change when the collection itself does - so cells skip re-rendering entirely
// as the visible window shifts (onSelect takes the card as an argument for this reason:
// a per-cell closure would defeat the memo).
import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { CardDefinition } from '../../game/cards/catalog'
import type { OwnedSummary } from '../../game/cards/collectionSummary'
import { VARIANT_LABEL } from '../../game/cards/variants'
import { CardArt } from './CardArt'
import { RARITY_COLOR, RARITY_GEM, collectionNo } from './cardTheme'

interface CardGridItemProps {
  card: CardDefinition
  owned: OwnedSummary
  setTotal: number
  favorite: boolean
  onSelect: (card: CardDefinition) => void
}

// Touch-tilt (see --tilt-x/--tilt-y/--press-scale in ui.css): written straight to the DOM via
// style.setProperty, not React state - a finger dragging across a card should never trigger a
// re-render, and this cell is memo()'d specifically to stay cheap while the grid scrolls.
// Mouse is excluded (pointerType check) - desktop already gets a hover lift (see ui.css), and
// firing both would fight over the same transform.
function updateTilt(el: HTMLElement, e: ReactPointerEvent) {
  const rect = el.getBoundingClientRect()
  const x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
  const y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
  el.style.setProperty('--tilt-x', x.toFixed(3))
  el.style.setProperty('--tilt-y', y.toFixed(3))
}

function resetTilt(el: HTMLElement) {
  el.style.setProperty('--tilt-x', '0')
  el.style.setProperty('--tilt-y', '0')
  el.style.setProperty('--press-scale', '1')
}

export const CardGridItem = memo(function CardGridItem({ card, owned, setTotal, favorite, onSelect }: CardGridItemProps) {
  const color = RARITY_COLOR[card.rarity]
  const variantClass = owned.bestVariant !== 'standard' ? `card-grid-item--${owned.bestVariant}` : ''
  // Legendary/ultra get a stronger, slowly pulsing glow so top-tier pulls stand out in the
  // grid at a glance, not just by border hue (see .card-grid-item--rarity-* in ui.css).
  const rarityClass = card.rarity === 'legendary' || card.rarity === 'ultra' ? `card-grid-item--rarity-${card.rarity}` : ''

  return (
    <button
      className={`card-grid-item cf-${card.rarity} ${variantClass} ${rarityClass}`}
      style={{ '--rarity-color': color } as CSSProperties}
      onClick={() => onSelect(card)}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        e.currentTarget.classList.add('card-grid-item--tilting')
        e.currentTarget.style.setProperty('--press-scale', '0.96')
        updateTilt(e.currentTarget, e)
        // Best-effort: keeps the tilt tracking a finger that drifts past this small cell's
        // edge mid-gesture. Not load-bearing for the visual feedback above, which must not be
        // skipped if this throws (browsers can reject a capture request in some edge cases).
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* pointer capture is a reliability nicety, not a requirement - ignore */
        }
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || !e.currentTarget.classList.contains('card-grid-item--tilting')) return
        updateTilt(e.currentTarget, e)
      }}
      onPointerUp={(e) => {
        e.currentTarget.classList.remove('card-grid-item--tilting')
        resetTilt(e.currentTarget)
      }}
      onPointerCancel={(e) => {
        e.currentTarget.classList.remove('card-grid-item--tilting')
        resetTilt(e.currentTarget)
      }}
    >
      <CardArt cardName={card.name} mode="grid" />
      {owned.bestVariant !== 'standard' && <div className="card-grid-variant">{VARIANT_LABEL[owned.bestVariant]}</div>}
      {owned.count > 1 && <div className="card-grid-count">×{owned.count}</div>}
      {favorite && <div className="card-grid-fav">♥</div>}
      <div className="card-grid-no">
        <img src={RARITY_GEM[card.rarity]} className="card-grid-gem" alt="" />
        {collectionNo(card.no, setTotal)}
      </div>
      <div className="card-grid-name">{card.name}</div>
    </button>
  )
})
