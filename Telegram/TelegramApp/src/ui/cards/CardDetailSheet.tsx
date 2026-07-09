// Card viewer (docs/CARD_SYSTEM_PLAN.md): tap to flip front/back, drag to tilt in 3D, or hit
// EXPLORE to open the live Phase 2 object viewer (ObjectViewer.tsx) for the body itself.
import { lazy, Suspense, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Sheet } from '../Sheet'
import { CardArt } from './CardArt'
import { RARITY_COLOR, collectionNo } from './cardTheme'
import { RARITY_LABEL, type CardDefinition } from '../../game/cards/catalog'
import { FULL_CATALOG } from '../../game/cards/generatedCards'
import { VARIANT_LABEL, variantRank } from '../../game/cards/variants'
import type { OwnedSummary } from '../../game/cards/collectionSummary'
import type { HoloLightVector } from './HoloOverlay'

const HoloOverlay = lazy(() => import('./HoloOverlay').then((m) => ({ default: m.HoloOverlay })))

interface CardDetailSheetProps {
  card: CardDefinition | null
  owned: OwnedSummary | null
  open: boolean
  onClose: () => void
  onExplore: () => void
}

const DRAG_TILT_MAX_DEG = 16
const CLICK_MOVE_THRESHOLD_PX = 6

export function CardDetailSheet({ card, owned, open, onClose, onExplore }: CardDetailSheetProps) {
  const [flipped, setFlipped] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startY: 0, moved: 0 })
  // Feeds the WebGL holo overlay's light vector from the exact same drag gesture that tilts the
  // card in CSS - one gesture, two readers, per docs/CARD_SYSTEM_PLAN.md §3's "uRotation reuse".
  const holoLightRef = useRef<HoloLightVector>({ x: 0, y: 0 })

  if (!card) return null
  const color = RARITY_COLOR[card.rarity]
  const locked = !owned

  const resetTilt = () => {
    if (wrapRef.current) wrapRef.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
    holoLightRef.current.x = 0
    holoLightRef.current.y = 0
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, moved: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || !wrapRef.current) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    drag.current.moved = Math.max(drag.current.moved, Math.hypot(dx, dy))
    const rotY = Math.max(-DRAG_TILT_MAX_DEG, Math.min(DRAG_TILT_MAX_DEG, dx * 0.22))
    const rotX = Math.max(-DRAG_TILT_MAX_DEG, Math.min(DRAG_TILT_MAX_DEG, -dy * 0.22))
    wrapRef.current.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`
    holoLightRef.current.x = rotY / DRAG_TILT_MAX_DEG
    holoLightRef.current.y = -rotX / DRAG_TILT_MAX_DEG
  }
  const onPointerUp = () => {
    const wasClick = drag.current.active && drag.current.moved < CLICK_MOVE_THRESHOLD_PX
    drag.current.active = false
    resetTilt()
    if (wasClick && !locked) setFlipped((f) => !f)
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setFlipped(false)
        onClose()
      }}
      title={locked ? 'UNDISCOVERED' : card.name}
    >
      <div
        ref={wrapRef}
        className="card-detail-tilt"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className={`card-detail-flip ${flipped ? 'card-detail-flip--back' : ''}`} style={{ '--rarity-color': color } as CSSProperties}>
          <div className="card-detail-face card-detail-face--front">
            {locked ? (
              <div className="card-detail-art-wrap">
                <div className="card-art card-art-ghost card-detail-art" />
              </div>
            ) : (
              <div className="card-detail-art-wrap">
                <CardArt cardName={card.name} mode="focused" className="card-detail-art" />
                {owned && variantRank(owned.bestVariant) >= variantRank('holo') && (
                  <Suspense fallback={null}>
                    <HoloOverlay rarity={card.rarity} lightRef={holoLightRef} className="card-detail-holo-overlay" />
                  </Suspense>
                )}
              </div>
            )}
            <div className="card-detail-rarity-tag">{RARITY_LABEL[card.rarity]}</div>
            <div className="card-detail-name">{locked ? '???' : card.name}</div>
            <div className="card-detail-no">{collectionNo(card.no, FULL_CATALOG.length)}</div>
            {owned && (
              <div className="card-detail-mint">
                Mint #{String(owned.bestSerial).padStart(4, '0')}
                {owned.bestVariant !== 'standard' ? ` · ${VARIANT_LABEL[owned.bestVariant].toUpperCase()}` : ''}
                {owned.count > 1 ? ` · ×${owned.count} owned` : ''}
              </div>
            )}
            {!locked && <div className="card-detail-flip-hint">TAP TO FLIP</div>}
            {!locked && (
              <button
                className="card-detail-explore-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onExplore()
                }}
              >
                EXPLORE
              </button>
            )}
          </div>
          <div className="card-detail-face card-detail-face--back">
            {locked ? (
              <div className="card-detail-locked-body">Defeat the right boss to discover this card.</div>
            ) : (
              <>
                <div className="card-detail-classification">{card.classification}</div>
                <div className="card-detail-flavor">"{card.flavor}"</div>
                <div className="card-detail-section-label">PHYSICAL CHARACTERISTICS</div>
                <div className="card-detail-physical">
                  {Object.entries(card.physical).map(([label, value]) => (
                    <div key={label} className="card-detail-physical-row">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="card-detail-section-label">FACTS</div>
                <ul className="card-detail-facts">
                  {card.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {card.discovery && <div className="card-detail-discovery">{card.discovery}</div>}
              </>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
