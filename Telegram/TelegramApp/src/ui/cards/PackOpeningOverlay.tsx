// The pack-opening ceremony, fullscreen edition - Balatro-informed feel: nothing on this
// screen ever sits perfectly still, every interaction has weight (lift -> flip -> land), and
// big moments interrupt rhythm (silence before a legendary boom, the wrapper BURSTING instead
// of politely opening). The server has already rolled and minted everything by the time the
// wrapper tears - this only choreographs what's inside.
//
// Phases: pack (hold-to-tear, escalating shake) -> burst (flash + shockwave, server round-trip
// hides inside it) -> dealing (cards fly in face-down, staggered) -> reveal (tap: top card
// lifts, flips with squash, lands with a thump; the back's edge glow is the rarity tell) ->
// recap (best pull enthroned). CONTINUE loops to the next pack without leaving the overlay.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CardArt } from './CardArt'
import { RARITY_COLOR } from './cardTheme'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticSuccess, hapticTap } from '../../telegram'
import { RARITY_LABEL, type CardRarity } from '../../game/cards/catalog'
import { cardById } from '../../game/cards/generatedCards'
import { VARIANT_LABEL } from '../../game/cards/variants'
import { openPackRequest, PACK_LABEL, type MintedCard, type OpenPackResult, type PendingPack } from '../../game/cards/cardsApi'

interface PackOpeningOverlayProps {
  apiBaseUrl: string | undefined
  pendingPacks: PendingPack[]
  onOpened: (packId: number, result: OpenPackResult) => void
  open: boolean
  onClose: () => void
}

const RARITY_RANK: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, ultra: 5 }
const TEAR_HOLD_MS = 900
const DEAL_STAGGER_MS = 110

type Phase =
  | { kind: 'pack' }
  | { kind: 'burst' }
  | { kind: 'dealing'; result: OpenPackResult }
  | { kind: 'reveal'; result: OpenPackResult; flipped: number; lifting: boolean }
  | { kind: 'recap'; result: OpenPackResult }

export function PackOpeningOverlay({ apiBaseUrl, pendingPacks, onOpened, open, onClose }: PackOpeningOverlayProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'pack' })
  const [tearing, setTearing] = useState(false)
  const [tearProgress, setTearProgress] = useState(0)
  const [shake, setShake] = useState(0)
  const tearRaf = useRef(0)
  const tearStart = useRef(0)
  const busy = useRef(false)
  const reducedMotion = useRef(false)

  const currentPack = pendingPacks[0] ?? null

  useEffect(() => {
    if (open) {
      reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      setPhase({ kind: 'pack' })
      setTearing(false)
      setTearProgress(0)
      busy.current = false
    }
    return () => cancelAnimationFrame(tearRaf.current)
  }, [open])

  // Deal timing: whooshes fire in sync with each card's CSS fly-in delay.
  useEffect(() => {
    if (phase.kind !== 'dealing') return
    const n = phase.result.cards.length
    const timers: Array<ReturnType<typeof setTimeout>> = []
    for (let i = 0; i < n; i++) {
      timers.push(
        setTimeout(() => {
          audio.dealWhoosh()
          hapticTap()
        }, i * DEAL_STAGGER_MS),
      )
    }
    timers.push(setTimeout(() => setPhase({ kind: 'reveal', result: phase.result, flipped: 0, lifting: false }), n * DEAL_STAGGER_MS + 480))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind])

  if (!open) return null

  // --- hold-to-tear ---
  const beginTear = () => {
    if (busy.current || !currentPack || phase.kind !== 'pack') return
    setTearing(true)
    tearStart.current = performance.now()
    audio.click()
    const tick = () => {
      const p = Math.min(1, (performance.now() - tearStart.current) / TEAR_HOLD_MS)
      setTearProgress(p)
      if (p > 0.25 && Math.floor(p * 9) !== Math.floor(((performance.now() - 16 - tearStart.current) / TEAR_HOLD_MS) * 9)) hapticTap()
      if (p >= 1) {
        void completeTear(currentPack.id)
        return
      }
      tearRaf.current = requestAnimationFrame(tick)
    }
    tearRaf.current = requestAnimationFrame(tick)
  }

  const cancelTear = () => {
    if (phase.kind !== 'pack') return
    cancelAnimationFrame(tearRaf.current)
    setTearing(false)
    setTearProgress(0)
  }

  const completeTear = async (packId: number) => {
    cancelAnimationFrame(tearRaf.current)
    busy.current = true
    setPhase({ kind: 'burst' })
    audio.packTear()
    setTimeout(() => audio.packBurst(), 90)
    hapticAction()
    setShake((n) => n + 1)
    const r = await openPackRequest(apiBaseUrl, packId)
    busy.current = false
    setTearing(false)
    setTearProgress(0)
    if (r) {
      onOpened(packId, r)
      // Let the burst flash breathe for a beat even on a fast server.
      setTimeout(() => setPhase({ kind: 'dealing', result: r }), 300)
    } else {
      setPhase({ kind: 'pack' })
    }
  }

  // --- reveal: lift -> flip -> land ---
  const flipNext = () => {
    if (phase.kind !== 'reveal' || phase.lifting || phase.flipped >= phase.result.cards.length) return
    const card = phase.result.cards[phase.flipped]
    const rank = RARITY_RANK[card.rarity]
    audio.cardLift()
    hapticTap()
    setPhase({ ...phase, lifting: true })
    const liftMs = reducedMotion.current ? 0 : 170
    setTimeout(() => {
      // The flip lands: sound by rarity, weight by rarity.
      if (rank >= 4) {
        audio.silence(170)
        audio.bossDown()
        hapticSuccess()
        setShake((n) => n + 1)
      } else if (rank >= 3) {
        audio.prestige()
        hapticSuccess()
      } else {
        audio.combo(Math.min(8, phase.flipped + 1))
      }
      setTimeout(() => audio.cardLand(), reducedMotion.current ? 0 : 240)
      const flipped = phase.flipped + 1
      setPhase({ kind: 'reveal', result: phase.result, flipped, lifting: false })
      if (flipped >= phase.result.cards.length) {
        setTimeout(() => setPhase({ kind: 'recap', result: phase.result }), 850)
      }
    }, liftMs)
  }

  const bestPull = (result: OpenPackResult): MintedCard =>
    [...result.cards].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || (b.variant === 'standard' ? 0 : 1) - (a.variant === 'standard' ? 0 : 1))[0]

  const continueAfterRecap = () => {
    audio.click()
    hapticTap()
    if (pendingPacks.length > 0) setPhase({ kind: 'pack' })
    else onClose()
  }

  const shakeClass = phase.kind === 'burst' ? 'pack-overlay--shake' : ''
  const topPendingRarity = phase.kind === 'reveal' && phase.flipped < phase.result.cards.length ? phase.result.cards[phase.flipped].rarity : null

  return (
    <div key={shake} className={`pack-overlay ${shakeClass}`}>
      <div className={`pack-overlay-vignette ${topPendingRarity && RARITY_RANK[topPendingRarity] >= 3 ? 'pack-overlay-vignette--charged' : ''}`} />

      <div className="pack-overlay-header">
        <div className="pack-overlay-title">
          {phase.kind === 'recap' ? 'PACK RESULTS' : currentPack ? PACK_LABEL[currentPack.type] : 'CARD PACKS'}
          {pendingPacks.length > 1 && phase.kind === 'pack' && <span className="pack-overlay-count"> · {pendingPacks.length} LEFT</span>}
        </div>
        {(phase.kind === 'pack' || phase.kind === 'recap') && (
          <button className="pack-overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </div>

      {phase.kind === 'pack' &&
        (currentPack ? (
          <div className="pack-overlay-stage">
            <button
              className={`pack-wrapper ${tearing ? 'pack-wrapper--tearing' : ''}`}
              style={{ '--tear': tearProgress, '--pack-glow': RARITY_COLOR[currentPack.type === 'singularity' ? 'legendary' : currentPack.type === 'deepsky' ? 'epic' : currentPack.type === 'stellar' ? 'rare' : 'uncommon'] } as CSSProperties}
              onPointerDown={beginTear}
              onPointerUp={cancelTear}
              onPointerLeave={cancelTear}
              onPointerCancel={cancelTear}
            >
              <div className="pack-wrapper-body">
                <div className="pack-wrapper-seam" />
                <div className="pack-wrapper-emblem">✦</div>
                <div className="pack-wrapper-label">{PACK_LABEL[currentPack.type]}</div>
              </div>
            </button>
            <div className="pack-overlay-hint">{tearing ? 'KEEP HOLDING…' : 'HOLD TO TEAR OPEN'}</div>
          </div>
        ) : (
          <div className="pack-overlay-stage">
            <div className="pack-overlay-empty">No packs waiting - defeat bosses to earn more.</div>
          </div>
        ))}

      {phase.kind === 'burst' && (
        <div className="pack-overlay-stage">
          <div className="pack-burst-flash" />
          <div className="pack-burst-ring" />
        </div>
      )}

      {(phase.kind === 'dealing' || phase.kind === 'reveal') && (
        <div className="pack-overlay-stage" onClick={phase.kind === 'reveal' ? flipNext : undefined}>
          <div className="pack-table">
            {phase.result.cards.map((c, i) => {
              const revealed = phase.kind === 'reveal' && i < phase.flipped
              const isTop = phase.kind === 'reveal' && i === phase.flipped
              const lifting = isTop && phase.kind === 'reveal' && phase.lifting
              return (
                <OverlayCard
                  key={`${c.cardId}-${c.serial}`}
                  card={c}
                  index={i}
                  total={phase.result.cards.length}
                  dealing={phase.kind === 'dealing'}
                  revealed={revealed}
                  isTop={isTop}
                  lifting={lifting}
                />
              )
            })}
          </div>
          {phase.kind === 'reveal' && phase.flipped < phase.result.cards.length && <div className="pack-overlay-hint pack-overlay-hint--low">TAP TO REVEAL</div>}
        </div>
      )}

      {phase.kind === 'recap' && (
        <div className="pack-overlay-stage pack-overlay-stage--recap">
          <RecapBest card={bestPull(phase.result)} />
          <div className="pack-recap-row">
            {phase.result.cards
              .filter((c) => c !== bestPull(phase.result))
              .map((c, i) => (
                <RecapMini key={`${c.cardId}-${c.serial}`} card={c} index={i} />
              ))}
          </div>
          <button className="sheet-button-primary pack-overlay-continue" onClick={continueAfterRecap}>
            {pendingPacks.length > 0 ? `NEXT PACK (${pendingPacks.length})` : 'DONE'}
          </button>
        </div>
      )}
    </div>
  )
}

function OverlayCard({ card, index, total, dealing, revealed, isTop, lifting }: { card: MintedCard; index: number; total: number; dealing: boolean; revealed: boolean; isTop: boolean; lifting: boolean }) {
  const def = cardById(card.cardId)
  const color = RARITY_COLOR[card.rarity]
  // Face-down pile: slight per-card offset + rotation so it reads as a hand-thrown stack.
  const stackRot = ((index * 137) % 9) - 4
  const stackY = (total - 1 - index) * 4
  return (
    <div
      className={[
        'pack-card',
        dealing ? 'pack-card--dealing' : '',
        revealed ? 'pack-card--revealed' : '',
        isTop && !revealed ? 'pack-card--top' : '',
        lifting ? 'pack-card--lifting' : '',
      ].join(' ')}
      style={
        {
          '--rarity-color': color,
          '--stack-rot': `${stackRot}deg`,
          '--stack-y': `${stackY}px`,
          '--deal-delay': `${index * DEAL_STAGGER_MS}ms`,
          '--drift-delay': `${(index * 611) % 1700}ms`,
          zIndex: revealed ? 40 + index : total - index,
        } as CSSProperties
      }
    >
      <div className="pack-card-inner">
        <div className="pack-card-back">
          <div className="pack-card-back-emblem">✦</div>
        </div>
        <div className="pack-card-front">
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

function RecapBest({ card }: { card: MintedCard }) {
  const def = cardById(card.cardId)
  return (
    <div className="pack-recap-best" style={{ '--rarity-color': RARITY_COLOR[card.rarity] } as CSSProperties}>
      <div className="pack-recap-best-crown">BEST PULL</div>
      <CardArt cardName={def?.name ?? card.cardId} mode="grid" className="pack-reveal-art" />
      <div className="pack-reveal-name">{def?.name ?? card.cardId}</div>
      <div className="pack-reveal-rarity">
        {RARITY_LABEL[card.rarity]}
        {card.variant !== 'standard' ? ` · ${VARIANT_LABEL[card.variant].toUpperCase()}` : ''}
      </div>
      {card.isNew && <div className="pack-reveal-new">NEW</div>}
    </div>
  )
}

function RecapMini({ card, index }: { card: MintedCard; index: number }) {
  const def = cardById(card.cardId)
  return (
    <div className="pack-recap-mini" style={{ '--rarity-color': RARITY_COLOR[card.rarity], '--pop-delay': `${index * 90}ms` } as CSSProperties}>
      <CardArt cardName={def?.name ?? card.cardId} mode="grid" className="pack-reveal-art" />
      <div className="pack-recap-mini-name">{def?.name ?? card.cardId}</div>
      {card.isNew && <div className="pack-reveal-new">NEW</div>}
    </div>
  )
}
