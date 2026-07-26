// Fill (or clear) one Talent Tree Gem Socket with an owned card. Adapts ShowcaseEditor's
// search-over-owned-cards picker pattern, but keyed by a fixed talent nodeId rather than an
// ordered/collapsible slot array - a socket is a specific tree position, not a reorderable list
// entry, so there's no move/reorder here, just fill/replace/remove.
import { useMemo, useState } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import type { CardDefinition } from '../../game/cards/catalog'
import { cardById } from '../../game/cards/generatedCards'
import { summarizeCollection } from '../../game/cards/collectionSummary'
import type { OwnedCard } from '../../game/cards/cardsApi'
import { saveGemSockets } from '../../game/cards/cardsApi'
import { gemAbilityForCard } from '../../game/cards/gemAbility'
import type { CardVariant } from '../../game/cards/variants'
import { RARITY_COLOR } from './cardTheme'
import { CardArt } from './CardArt'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticTap } from '../../telegram'
import { Sheet } from '../Sheet'

interface SocketPickerSheetProps {
  session: GameSession
  apiBaseUrl: string | undefined
  ownedCards: OwnedCard[]
  /** Which Gem Socket node is being edited, or null when the sheet is closed. */
  nodeId: string | null
  onClose: () => void
  onToast: (text: string) => void
}

export function SocketPickerSheet({ session: s, apiBaseUrl, ownedCards, nodeId, onClose, onToast }: SocketPickerSheetProps) {
  const [query, setQuery] = useState('')
  const summary = useMemo(() => summarizeCollection(ownedCards), [ownedCards])

  const defs = Array.from({ length: s.talents.count }, (_, i) => s.talents.def(i))
  const def = nodeId ? defs.find((d) => d.id === nodeId) : undefined

  const current = nodeId ? s.gems.cardAt(nodeId) : undefined
  const currentCard = current ? cardById(current.cardId) : undefined
  const currentAbility = current ? gemAbilityForCard(current.cardId) : undefined

  const assignedElsewhere = useMemo(() => {
    const set = new Set<string>()
    for (const a of s.gems.serialize()) if (a.nodeId !== nodeId) set.add(a.cardId)
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, current])

  const pickResults = useMemo(() => {
    if (!nodeId) return []
    const q = query.trim().toLowerCase()
    const out: Array<{ card: CardDefinition; variant: CardVariant }> = []
    for (const [cardId, sum] of summary) {
      if (assignedElsewhere.has(cardId)) continue
      const card = cardById(cardId)
      if (!card) continue
      if (q && !card.name.toLowerCase().includes(q)) continue
      out.push({ card, variant: sum.bestVariant })
      if (out.length >= 40) break
    }
    return out
  }, [nodeId, query, summary, assignedElsewhere])

  const pick = (card: CardDefinition, variant: CardVariant) => {
    if (!nodeId) return
    s.gems.setSocket(nodeId, card.id, variant)
    void saveGemSockets(apiBaseUrl, s.gems.serialize()) // fire-and-forget; server re-validates ownership
    setQuery('')
    audio.purchase()
    hapticAction()
    onToast('GEM SOCKETED')
    onClose()
  }

  const removeCurrent = () => {
    if (!nodeId) return
    s.gems.clearSocket(nodeId)
    void saveGemSockets(apiBaseUrl, s.gems.serialize())
    audio.click()
    hapticTap()
    onToast('SOCKET CLEARED')
    onClose()
  }

  return (
    <Sheet open={nodeId !== null} onClose={onClose} title={def ? def.displayName.toUpperCase() : 'GEM SOCKET'}>
      <div className="socket-picker">
        {def && <div className="socket-picker-desc">{def.description}</div>}

        {current && (
          <div className="socket-picker-current">
            <div className="profile-section-label">CURRENTLY SOCKETED</div>
            <div className={`socket-picker-current-row ${currentCard ? `cf-${currentCard.rarity}` : ''}`}>
              {currentCard && <CardArt cardName={currentCard.name} mode="grid" className="socket-picker-current-art" />}
              <div className="socket-picker-current-info">
                <div className="socket-picker-current-name" style={{ color: currentCard ? RARITY_COLOR[currentCard.rarity] : undefined }}>
                  {currentCard?.name ?? current.cardId}
                </div>
                {currentAbility && <div className="socket-picker-current-ability">{currentAbility.label}</div>}
              </div>
              <button className="socket-picker-remove" onClick={removeCurrent}>
                REMOVE
              </button>
            </div>
          </div>
        )}

        <input className="cards-search" type="search" placeholder="Search owned cards..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={!current} />
        <div className="socket-picker-list">
          {pickResults.length === 0 && <div className="cards-empty">No owned cards match.</div>}
          {pickResults.map(({ card, variant }) => {
            const ability = gemAbilityForCard(card.id)
            return (
              <button key={card.id} className="socket-picker-item" onClick={() => pick(card, variant)}>
                <span className="socket-picker-item-name" style={{ color: RARITY_COLOR[card.rarity] }}>
                  {card.name}
                </span>
                <span className="socket-picker-item-ability">{ability?.label ?? ''}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
