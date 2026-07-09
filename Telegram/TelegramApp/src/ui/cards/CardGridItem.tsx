// One collection grid cell. Owned-only by design: the collection never renders ghosts,
// silhouettes, or locked placeholders - a card exists in the UI only once you own it.
import type { CSSProperties } from 'react'
import type { CardDefinition } from '../../game/cards/catalog'
import type { OwnedSummary } from '../../game/cards/collectionSummary'
import { VARIANT_LABEL } from '../../game/cards/variants'
import { CardArt } from './CardArt'
import { RARITY_COLOR, collectionNo } from './cardTheme'

interface CardGridItemProps {
  card: CardDefinition
  owned: OwnedSummary
  setTotal: number
  favorite: boolean
  onSelect: () => void
}

export function CardGridItem({ card, owned, setTotal, favorite, onSelect }: CardGridItemProps) {
  const color = RARITY_COLOR[card.rarity]
  const variantClass = owned.bestVariant !== 'standard' ? `card-grid-item--${owned.bestVariant}` : ''

  return (
    <button className={`card-grid-item ${variantClass}`} style={{ '--rarity-color': color } as CSSProperties} onClick={onSelect}>
      <CardArt cardName={card.name} mode="grid" />
      {owned.bestVariant !== 'standard' && <div className="card-grid-variant">{VARIANT_LABEL[owned.bestVariant]}</div>}
      {owned.count > 1 && <div className="card-grid-count">×{owned.count}</div>}
      {favorite && <div className="card-grid-fav">♥</div>}
      <div className="card-grid-no">{collectionNo(card.no, setTotal)}</div>
      <div className="card-grid-name">{card.name}</div>
    </button>
  )
}
