// The pack-opening ceremony. The server has already rolled and minted everything by the time
// a result comes back - this only choreographs the reveal:
//   list -> HOLD to tear the wrapper (haptic ramp) -> cards stack face-down -> tap flips one
//   at a time (the card back's edge glow hints the coming rarity - collectors learn the tell)
//   -> best-pull recap.
// Legendary+ flips get a beat of silence, then the boom (AudioManager.silence).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Sheet } from '../Sheet'
import { CardArt } from './CardArt'
import { RARITY_COLOR } from './cardTheme'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticSuccess, hapticTap } from '../../telegram'
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

const RARITY_RANK: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, ultra: 5 }
const TEAR_HOLD_MS = 850

type Phase = { kind: 'list' } | { kind: 'stack'; result: OpenPackResult; flipped: number } | { kind: 'recap'; result: OpenPackResult }

export function PackOpenSheet({ apiBaseUrl, pendingPacks, onOpened, open, onClose }: PackOpenSheetProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'list' })
  const [tearingId, setTearingId] = useState<number | null>(null)
  const [tearProgress, setTearProgress] = useState(0)
  const tearRaf = useRef(0)
  const tearStart = useRef(0)
  const opening = useRef(false)

  useEffect(() => {
    if (open) {
      setPhase({ kind: 'list' })
      setTearingId(null)
      setTearProgress(0)
      opening.current = false
    }
    return () => cancelAnimationFrame(tearRaf.current)
  }, [open])

  // --- hold-to-tear ---
  const beginTear = (packId: number) => {
    if (opening.current) return
    setTearingId(packId)
    tearStart.current = performance.now()
    audio.click()
    const tick = () => {
      const p = Math.min(1, (performance.now() - tearStart.current) / TEAR_HOLD_MS)
      setTearProgress(p)
      // Haptic ramp: ticks get denser as the tear completes.
      if (p > 0.3 && Math.floor(p * 8) !== Math.floor(((performance.now() - 16 - tearStart.current) / TEAR_HOLD_MS) * 8)) hapticTap()
      if (p >= 1) {
        completeTear(packId)
        return
      }
      tearRaf.current = requestAnimationFrame(tick)
    }
    tearRaf.current = requestAnimationFrame(tick)
  }

  const cancelTear = () => {
    cancelAnimationFrame(tearRaf.current)
    setTearingId(null)
    setTearProgress(0)
  }

  const completeTear = async (packId: number) => {
    cancelAnimationFrame(tearRaf.current)
    opening.current = true
    audio.packTear()
    hapticAction()
    const r = await openPackRequest(apiBaseUrl, packId)
    opening.current = false
    setTearingId(null)
    setTearProgress(0)
    if (r) {
      onOpened(packId, r)
      setPhase({ kind: 'stack', result: r, flipped: 0 })
    }
  }

  // --- per-card flip ---
  const flipNext = () => {
    if (phase.kind !== 'stack') return
    const card = phase.result.cards[phase.flipped]
    const rank = RARITY_RANK[card.rarity]
    if (rank >= 4) {
      // Legendary+: a beat of hush, then the boom lands with the flip.
      audio.silence(160)
      audio.bossDown()
      hapticSuccess()
    } else if (rank >= 3) {
      audio.prestige()
      hapticSuccess()
    } else {
      audio.combo(Math.min(8, phase.flipped + 1)) // ascending pitch as the pack progresses
      hapticTap()
    }
    const flipped = phase.flipped + 1
    if (flipped >= phase.result.cards.length) {
      setPhase({ kind: 'stack', result: phase.result, flipped })
      setTimeout(() => setPhase({ kind: 'recap', result: phase.result }), 700)
    } else {
      setPhase({ kind: 'stack', result: phase.result, flipped })
    }
  }

  const bestPull = (result: OpenPackResult): MintedCard =>
    [...result.cards].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || (b.variant === 'standard' ? 0 : 1) - (a.variant === 'standard' ? 0 : 1))[0]

  return (
    <Sheet open={open} onClose={onClose} title={phase.kind === 'list' ? 'CARD PACKS' : phase.kind === 'recap' ? 'PACK RESULTS' : PACK_LABEL[phase.result.packType]}>
      {phase.kind === 'list' &&
        (pendingPacks.length === 0 ? (
          <div className="pack-empty">No packs waiting - defeat bosses to earn more.</div>
        ) : (
          <div className="pack-list">
            {pendingPacks.map((p) => (
              <button
                key={p.id}
                className={`pack-item ${tearingId === p.id ? 'pack-item--tearing' : ''}`}
                onPointerDown={() => beginTear(p.id)}
                onPointerUp={cancelTear}
                onPointerLeave={cancelTear}
                onPointerCancel={cancelTear}
              >
                <div className="pack-item-icon" style={{ '--tear': tearingId === p.id ? tearProgress : 0 } as CSSProperties} />
                <div className="pack-item-label">{PACK_LABEL[p.type]}</div>
                <div className="pack-item-open">{tearingId === p.id ? 'TEARING…' : 'HOLD TO TEAR'}</div>
                {tearingId === p.id && <div className="pack-tear-bar" style={{ width: `${tearProgress * 100}%` }} />}
              </button>
            ))}
          </div>
        ))}

      {phase.kind === 'stack' && (
        <div className="pack-stack" onClick={flipNext}>
          {phase.result.cards.map((c, i) => {
            const revealed = i < phase.flipped
            const isTop = i === phase.flipped
            return (
              <StackCard key={`${c.cardId}-${c.serial}`} card={c} index={i} total={phase.result.cards.length} revealed={revealed} isTop={isTop} />
            )
          })}
          <div className="pack-stack-hint">{phase.flipped < phase.result.cards.length ? 'TAP TO REVEAL' : ''}</div>
        </div>
      )}

      {phase.kind === 'recap' && (
        <div className="pack-recap">
          <div className="pack-recap-grid">
            {phase.result.cards.map((c) => (
              <RecapCard key={`${c.cardId}-${c.serial}`} card={c} isBest={c === bestPull(phase.result)} />
            ))}
          </div>
          <button className="sheet-button-primary pack-reveal-done" onClick={() => setPhase({ kind: 'list' })}>
            {pendingPacks.length > 0 ? 'CONTINUE' : 'DONE'}
          </button>
        </div>
      )}
    </Sheet>
  )
}

/** One card in the face-down stack. The BACK's edge glow is the rarity tell. */
function StackCard({ card, index, total, revealed, isTop }: { card: MintedCard; index: number; total: number; revealed: boolean; isTop: boolean }) {
  const def = cardById(card.cardId)
  const color = RARITY_COLOR[card.rarity]
  const offset = (total - 1 - index) * 3
  return (
    <div
      className={`pack-stack-card ${revealed ? 'pack-stack-card--revealed' : ''} ${isTop ? 'pack-stack-card--top' : ''}`}
      style={{ '--rarity-color': color, '--stack-offset': `${offset}px`, zIndex: revealed ? 40 + index : total - index } as CSSProperties}
    >
      <div className="pack-stack-card-inner">
        <div className="pack-stack-card-back" />
        <div className="pack-stack-card-front">
          <CardArt cardName={def?.name ?? card.cardId} mode="grid" className="pack-reveal-art" />
          <div className="pack-reveal-rarity">{RARITY_LABEL[card.rarity]}</div>
          <div className="pack-reveal-name">{def?.name ?? card.cardId}</div>
          {card.variant !== 'standard' && <div className={`pack-reveal-variant pack-reveal-variant--${card.variant}`}>{VARIANT_LABEL[card.variant].toUpperCase()}</div>}
          {card.isNew && <div className="pack-reveal-new">NEW</div>}
          <div className="pack-reveal-serial">#{String(card.serial).padStart(4, '0')}</div>
        </div>
      </div>
    </div>
  )
}

function RecapCard({ card, isBest }: { card: MintedCard; isBest: boolean }) {
  const def = cardById(card.cardId)
  return (
    <div className={`pack-recap-card ${isBest ? 'pack-recap-card--best' : ''}`} style={{ '--rarity-color': RARITY_COLOR[card.rarity] } as CSSProperties}>
      <CardArt cardName={def?.name ?? card.cardId} mode="grid" className="pack-reveal-art" />
      <div className="pack-reveal-name">{def?.name ?? card.cardId}</div>
      <div className="pack-reveal-rarity">{RARITY_LABEL[card.rarity]}</div>
      {card.isNew && <div className="pack-reveal-new">NEW</div>}
      {isBest && <div className="pack-recap-best-tag">BEST PULL</div>}
    </div>
  )
}
