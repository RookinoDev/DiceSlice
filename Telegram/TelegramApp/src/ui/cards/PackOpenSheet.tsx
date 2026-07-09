// Pack inventory + opening ceremony (docs/CARD_SYSTEM_PLAN.md Phase 1). The server has already
// rolled and minted everything by the time a result comes back - this only animates it.
import { useEffect, useState, type CSSProperties } from 'react'
import { Sheet } from '../Sheet'
import { CardArt } from './CardArt'
import { RARITY_COLOR } from './cardTheme'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticSuccess } from '../../telegram'
import { RARITY_LABEL, type CardRarity } from '../../game/cards/catalog'
import { cardById } from '../../game/cards/generatedCards'
import { VARIANT_LABEL } from '../../game/cards/variants'
import { openPackRequest, PACK_LABEL, type MintedCard, type OpenPackResult, type PendingPack } from '../../game/cards/cardsApi'

interface PackOpenSheetProps {
  apiBaseUrl: string | undefined
  pendingPacks: PendingPack[]
  onOpened: (packId: number, result: OpenPackResult) => void
  open: boolean
  onClose: () => void
}

const HIGH_RARITIES: CardRarity[] = ['legendary', 'ultra']

export function PackOpenSheet({ apiBaseUrl, pendingPacks, onOpened, open, onClose }: PackOpenSheetProps) {
  const [opening, setOpening] = useState(false)
  const [result, setResult] = useState<OpenPackResult | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    if (open) {
      setResult(null)
      setRevealedCount(0)
      setOpening(false)
    }
  }, [open])

  // Stagger the reveal: each card gets its own flip-in beat instead of all landing at once.
  useEffect(() => {
    if (!result || revealedCount >= result.cards.length) return
    const card = result.cards[revealedCount]
    const isBig = HIGH_RARITIES.includes(card.rarity)
    const t = setTimeout(
      () => {
        setRevealedCount((n) => n + 1)
        if (isBig) {
          audio.prestige()
          hapticSuccess()
        } else {
          audio.purchase()
          hapticAction()
        }
      },
      revealedCount === 0 ? 300 : 550,
    )
    return () => clearTimeout(t)
  }, [result, revealedCount])

  const handleOpen = async (packId: number) => {
    setOpening(true)
    audio.click()
    hapticAction()
    const r = await openPackRequest(apiBaseUrl, packId)
    setOpening(false)
    if (r) {
      setResult(r)
      onOpened(packId, r)
    }
  }

  const cardName = (cardId: string) => cardById(cardId)?.name ?? cardId

  return (
    <Sheet open={open} onClose={onClose} title={result ? 'PACK OPENED' : 'CARD PACKS'}>
      {result ? (
        <div className="pack-reveal">
          <div className="pack-reveal-grid">
            {result.cards.map((c, i) => (
              <RevealedCard key={`${c.cardId}-${c.serial}`} card={c} name={cardName(c.cardId)} revealed={i < revealedCount} />
            ))}
          </div>
          {revealedCount >= result.cards.length && (
            <button className="sheet-button-primary pack-reveal-done" onClick={() => setResult(null)}>
              {pendingPacks.length > 1 ? 'CONTINUE' : 'DONE'}
            </button>
          )}
        </div>
      ) : pendingPacks.length === 0 ? (
        <div className="pack-empty">No packs waiting - defeat bosses to earn more.</div>
      ) : (
        <div className="pack-list">
          {pendingPacks.map((p) => (
            <button key={p.id} className="pack-item" disabled={opening} onClick={() => handleOpen(p.id)}>
              <div className="pack-item-icon" />
              <div className="pack-item-label">{PACK_LABEL[p.type]}</div>
              <div className="pack-item-open">{opening ? 'OPENING…' : 'TAP TO OPEN'}</div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function RevealedCard({ card, name, revealed }: { card: MintedCard; name: string; revealed: boolean }) {
  const color = RARITY_COLOR[card.rarity]
  return (
    <div
      className={`pack-reveal-card ${revealed ? 'pack-reveal-card--revealed' : ''} ${HIGH_RARITIES.includes(card.rarity) ? 'pack-reveal-card--big' : ''}`}
      style={{ '--rarity-color': color } as CSSProperties}
    >
      <div className="pack-reveal-card-inner">
        <div className="pack-reveal-card-back" />
        <div className="pack-reveal-card-front">
          <CardArt cardName={name} mode="grid" className="pack-reveal-art" />
          <div className="pack-reveal-rarity">{RARITY_LABEL[card.rarity]}</div>
          <div className="pack-reveal-name">{name}</div>
          {card.variant !== 'standard' && <div className={`pack-reveal-variant pack-reveal-variant--${card.variant}`}>{VARIANT_LABEL[card.variant].toUpperCase()}</div>}
          {card.isNew && <div className="pack-reveal-new">NEW</div>}
          <div className="pack-reveal-serial">#{String(card.serial).padStart(4, '0')}</div>
        </div>
      </div>
    </div>
  )
}
