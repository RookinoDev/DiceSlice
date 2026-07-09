// Collection grid (docs/CARD_SYSTEM_PLAN.md Phase 1): every catalog card, owned ones in full
// color, unowned as a locatable ghost slot. Purely presentational - GameShell owns fetching.
import { useMemo } from 'react'
import { CARD_CATALOG, SET_1_NAME, type CardDefinition } from '../../game/cards/catalog'
import type { OwnedCard } from '../../game/cards/cardsApi'
import { summarizeCollection } from '../../game/cards/collectionSummary'
import { CardGridItem } from '../cards/CardGridItem'

interface CardsScreenProps {
  ownedCards: OwnedCard[]
  pendingPackCount: number
  onSelectCard: (card: CardDefinition) => void
  onOpenPacks: () => void
}

export function CardsScreen({ ownedCards, pendingPackCount, onSelectCard, onOpenPacks }: CardsScreenProps) {
  const owned = useMemo(() => summarizeCollection(ownedCards), [ownedCards])
  const ownedCount = owned.size

  return (
    <div className="screen cards-screen">
      <div className="screen-header">
        <div>
          <div className="screen-title">COLLECTION</div>
          <div className="screen-subtitle">
            {SET_1_NAME} · {ownedCount} / {CARD_CATALOG.length}
          </div>
        </div>
        {pendingPackCount > 0 && (
          <button className="cards-open-packs-btn" onClick={onOpenPacks}>
            OPEN PACKS <span className="cards-open-packs-count">{pendingPackCount}</span>
          </button>
        )}
      </div>
      <div className="card-grid">
        {CARD_CATALOG.map((card) => (
          <CardGridItem key={card.id} card={card} owned={owned.get(card.id) ?? null} setTotal={CARD_CATALOG.length} onSelect={() => onSelectCard(card)} />
        ))}
      </div>
    </div>
  )
}
