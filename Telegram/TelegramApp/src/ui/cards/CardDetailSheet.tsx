// The focused card viewer - Balatro-grade feel on top of real data. One rAF spring drives
// tilt/wobble/zoom (underdamped, so releases bounce); tap flips with a squash beat; pinch or
// wheel zooms; per-variant CSS effects layer under the WebGL holo overlay (holo+ variants).
// EXPLORE opens the live object viewer (ObjectViewer.tsx) for the body itself.
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Sheet } from '../Sheet'
import { CardArt } from './CardArt'
import { RARITY_COLOR, RARITY_GEM, collectionNo } from './cardTheme'
import cornerOrnament from '../../assets/cards/frame-corner-ornament.png'
import { RARITY_LABEL, type CardDefinition } from '../../game/cards/catalog'
import { FULL_CATALOG } from '../../game/cards/generatedCards'
import { VARIANT_LABEL, variantRank } from '../../game/cards/variants'
import type { OwnedSummary } from '../../game/cards/collectionSummary'
import { loadFavorites, recordCardView, toggleFavorite } from '../../game/cards/cardPrefs'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticTap } from '../../telegram'
import { useParticles } from '../combatFx/useParticles'
import { ParticleLayer } from '../combatFx/ParticleLayer'
import type { HoloLightVector } from './HoloOverlay'

const HoloOverlay = lazy(() => import('./HoloOverlay').then((m) => ({ default: m.HoloOverlay })))

interface CardDetailSheetProps {
  card: CardDefinition | null
  owned: OwnedSummary | null
  open: boolean
  onClose: () => void
  onExplore: () => void
}

const DRAG_TILT_MAX_DEG = 18
const CLICK_MOVE_THRESHOLD_PX = 6
const ZOOM_MAX = 2.4
// Underdamped spring (damping ratio ~0.55): releases overshoot and wobble like a held card
// snapping back, not a UI tween. Tuned against 60fps; dt-scaled so slower frames stay stable.
const SPRING_K = 170
const SPRING_DAMP = 14

interface SpringState {
  rx: number
  ry: number
  rz: number
  scale: number
}

const REST: SpringState = { rx: 0, ry: 0, rz: 0, scale: 1 }

export function CardDetailSheet({ card, owned, open, onClose, onExplore }: CardDetailSheetProps) {
  const [flipped, setFlipped] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, startX: 0, startY: 0, moved: 0, lastX: 0, lastDx: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  // Spring state lives in refs - the rAF loop writes transforms directly, zero re-renders.
  const cur = useRef<SpringState>({ ...REST })
  const vel = useRef<SpringState>({ rx: 0, ry: 0, rz: 0, scale: 0 })
  const target = useRef<SpringState>({ ...REST })
  const reducedMotion = useRef(false)
  // Feeds the WebGL holo overlay's light vector from the exact same spring that tilts the card
  // in CSS - one physical model, two readers.
  const holoLightRef = useRef<HoloLightVector>({ x: 0, y: 0 })
  const { containerRef: particlesRef, spawn: spawnParticle } = useParticles()

  // The spring loop: runs only while the sheet is open.
  useEffect(() => {
    if (!open) return
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    let idleAngle = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const c = cur.current
      const v = vel.current
      const t = target.current
      for (const key of ['rx', 'ry', 'rz', 'scale'] as const) {
        if (reducedMotion.current) {
          c[key] = t[key]
          v[key] = 0
        } else {
          v[key] += (t[key] - c[key]) * SPRING_K * dt
          v[key] *= Math.exp(-SPRING_DAMP * dt)
          c[key] += v[key] * dt
        }
      }
      if (wrapRef.current) {
        wrapRef.current.style.transform = `perspective(900px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) scale(${c.scale})`
      }
      // Foil should never sit dead - while the card is untouched and settled flat, the light
      // vector slowly orbits on its own so holo+ cards keep shimmering at rest instead of only
      // reacting to a drag the player may never think to try. A live drag/tilt always wins.
      const settled = !drag.current.active && pointers.current.size === 0 && Math.abs(c.rx) < 0.4 && Math.abs(c.ry) < 0.4
      if (settled && !reducedMotion.current) {
        idleAngle += dt * 0.5
        holoLightRef.current.x = Math.sin(idleAngle) * 0.55
        holoLightRef.current.y = Math.cos(idleAngle * 0.7) * 0.55
      } else {
        holoLightRef.current.x = c.ry / DRAG_TILT_MAX_DEG
        holoLightRef.current.y = -c.rx / DRAG_TILT_MAX_DEG
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open])

  // Entry moment: record the view, pop the card in with an overshoot, celebrate rare cards.
  useEffect(() => {
    if (!open || !card) return
    setFlipped(false)
    setIsFavorite(loadFavorites().has(card.id))
    recordCardView(card.id)
    cur.current = { rx: 0, ry: 0, rz: 0, scale: 0.6 }
    vel.current = { rx: 0, ry: 0, rz: 0, scale: reducedMotion.current ? 0 : 3.5 }
    target.current = { ...REST }
    const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra'].indexOf(card.rarity)
    if (rank >= 4) {
      audio.prestige()
      // Rarity-colored burst around the card - rare pulls should feel like an event every view.
      const wrap = wrapRef.current
      const rect = wrap?.getBoundingClientRect()
      if (rect && !reducedMotion.current) {
        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * Math.PI * 2
          spawnParticle({
            className: 'fx-debris',
            x: rect.width / 2,
            y: rect.height / 2,
            durationMs: 700,
            style: {
              '--tx': `${Math.cos(angle) * (90 + Math.random() * 40)}px`,
              '--ty': `${Math.sin(angle) * (110 + Math.random() * 40)}px`,
              '--rot': `${(Math.random() - 0.5) * 360}deg`,
              background: RARITY_COLOR[card.rarity],
              animationDuration: '700ms',
            } as CSSProperties,
          })
        }
      }
    } else {
      audio.click()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id])

  if (!card) return null
  const color = RARITY_COLOR[card.rarity]
  const locked = !owned
  const variantClass = owned && owned.bestVariant !== 'standard' ? `card-detail-flip--${owned.bestVariant}` : ''
  const rarityClass = card.rarity === 'legendary' || card.rarity === 'ultra' ? `card-detail-flip--${card.rarity}` : ''

  const doFlip = () => {
    setFlipped((f) => !f)
    audio.click()
    hapticTap()
    // A flip lands with a little vertical squash: kick the scale spring instead of a keyframe
    // so it composes with whatever tilt/zoom is in flight. The spring writes transform via ref
    // every frame regardless of React state, so this needs no remount to show up.
    vel.current.scale -= 2.2
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // A pointer can vanish between events (and synthetic test pointers never exist) -
      // capture is a nicety for drags leaving the element, never worth aborting the gesture.
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: target.current.scale }
      drag.current.active = false
      return
    }
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, moved: 0, lastX: e.clientX, lastDx: 0 }
    // Grab feel: the card gives slightly under your finger.
    target.current.scale = Math.max(1, target.current.scale) * 0.97
    hapticTap()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId)
    if (p) {
      p.x = e.clientX
      p.y = e.clientY
    }
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      target.current.scale = Math.min(ZOOM_MAX, Math.max(1, (pinchStart.current.scale * dist) / pinchStart.current.dist))
      return
    }
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    drag.current.moved = Math.max(drag.current.moved, Math.hypot(dx, dy))
    drag.current.lastDx = e.clientX - drag.current.lastX
    drag.current.lastX = e.clientX
    target.current.ry = Math.max(-DRAG_TILT_MAX_DEG, Math.min(DRAG_TILT_MAX_DEG, dx * 0.22))
    target.current.rx = Math.max(-DRAG_TILT_MAX_DEG, Math.min(DRAG_TILT_MAX_DEG, -dy * 0.22))
    // Balatro wobble: horizontal motion rolls the card a touch around Z.
    target.current.rz = Math.max(-6, Math.min(6, drag.current.lastDx * 0.35))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      const wasClick = drag.current.active && drag.current.moved < CLICK_MOVE_THRESHOLD_PX
      drag.current.active = false
      // Release: everything springs home; the throw velocity carries into the wobble.
      vel.current.rz += drag.current.lastDx * 1.5
      target.current = { ...REST }
      if (wasClick && !locked) doFlip()
    }
  }

  // Desktop nicety: wheel zooms toward/away, springs included.
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    target.current.scale = Math.min(ZOOM_MAX, Math.max(1, target.current.scale - e.deltaY * 0.002))
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
      <div className="card-detail-stage">
        <div
          ref={wrapRef}
          className="card-detail-tilt"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <div
            className={`card-detail-flip cf-${card.rarity} ${flipped ? 'card-detail-flip--back' : ''} ${variantClass} ${rarityClass}`}
            style={{ '--rarity-color': color } as CSSProperties}
          >
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
              {!locked && (
                <button
                  className={`card-detail-fav-btn ${isFavorite ? 'card-detail-fav-btn--active' : ''}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsFavorite(toggleFavorite(card.id))
                    audio.click()
                    hapticTap()
                  }}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite ? '♥' : '♡'}
                </button>
              )}
              {/* Rarity tag + EXPLORE share one row - EXPLORE sits at the right, level with the
                  rarity it's themed to match, instead of floating off on its own near the bottom. */}
              <div className="card-detail-meta-row">
                <div className="card-detail-rarity-tag">{RARITY_LABEL[card.rarity]}</div>
                {!locked && (
                  <button
                    className="card-detail-explore-btn"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      hapticAction()
                      onExplore()
                    }}
                  >
                    EXPLORE
                  </button>
                )}
              </div>
              <div className="card-detail-eyebrow">{locked ? 'UNDISCOVERED' : card.classification.toUpperCase()}</div>
              <div className="card-detail-name">{locked ? '???' : card.name}</div>
              <div className="card-detail-no">
                {!locked && <img src={RARITY_GEM[card.rarity]} className="card-detail-gem" alt="" />}
                {collectionNo(card.no, FULL_CATALOG.length)}
              </div>
              {owned && (
                <div className="card-detail-mint">
                  Mint #{String(owned.bestSerial).padStart(4, '0')}
                  {owned.bestVariant !== 'standard' ? ` · ${VARIANT_LABEL[owned.bestVariant].toUpperCase()}` : ''}
                  {owned.count > 1 ? ` · ×${owned.count} owned` : ''}
                </div>
              )}
              {!locked && <div className="card-detail-flip-hint">TAP TO FLIP · DRAG TO TILT · PINCH TO ZOOM</div>}
              {!locked && (card.rarity === 'legendary' || card.rarity === 'ultra') && (
                <>
                  <img src={cornerOrnament} className="card-frame-corner card-frame-corner--tl" alt="" />
                  <img src={cornerOrnament} className="card-frame-corner card-frame-corner--tr" alt="" />
                  <img src={cornerOrnament} className="card-frame-corner card-frame-corner--bl" alt="" />
                  <img src={cornerOrnament} className="card-frame-corner card-frame-corner--br" alt="" />
                </>
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
        <ParticleLayer containerRef={particlesRef} />
      </div>
    </Sheet>
  )
}
