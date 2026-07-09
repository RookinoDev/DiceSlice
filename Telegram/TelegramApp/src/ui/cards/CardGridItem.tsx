// One collection grid cell. Owned cards show their real art + rarity frame; unowned cards show
// a dark silhouette so missing cards feel locatable (a hole in the set), not just absent.
import type { CSSProperties } from 'react'
import type { CardDefinition } from '../../game/cards/catalog'
import type { OwnedSummary } from '../../game/cards/collectionSummary'
import { CardArt } from './CardArt'
import { RARITY_COLOR, collectionNo } from './cardTheme'
import { LockIcon } from '../icons'

interface CardGridItemProps {
  card: CardDefinition
  owned: OwnedSummary | null
  setTotal: number
  onSelect: () => void
}

export function CardGridItem({ card, owned, setTotal, onSelect }: CardGridItemProps) {
  const color = RARITY_COLOR[card.rarity]

  if (!owned) {
    return (
      <button className="card-grid-item card-grid-item--ghost" onClick={onSelect} aria-label={`Undiscovered card ${card.no}`}>
        <div className="card-art card-art-ghost">
          <LockIcon size={16} />
        </div>
        <div className="card-grid-no">{collectionNo(card.no, setTotal)}</div>
      </button>
    )
  }

  return (
    <button className={`card-grid-item ${owned.hasHolo ? 'card-grid-item--holo' : ''}`} style={{ '--rarity-color': color } as CSSProperties} onClick={onSelect}>
      <CardArt cardName={card.name} mode="grid" />
      {owned.count > 1 && <div className="card-grid-count">×{owned.count}</div>}
      <div className="card-grid-no">{collectionNo(card.no, setTotal)}</div>
      <div className="card-grid-name">{card.name}</div>
    </button>
  )
}
