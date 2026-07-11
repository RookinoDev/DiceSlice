// Phase 2 (docs/CARD_SYSTEM_PLAN.md §5): tapping a card's artwork "opens" it into this live
// object viewer - the same PlanetCanvas shader, now with drag-to-orbit, pinch-to-dolly, tappable
// fact chips over signature features (§1), and a SCAN sweep that reveals physical stats with an
// animated count-up. This renderer is a flat rotating disc (see PlanetCanvas.tsx), not a real
// 3D globe, so "orbit" is a 2D spin + a gas-giant-only polar nudge, not true 6DoF rotation.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sheet } from '../Sheet'
import { realPlanetByName } from '../../planet/realPlanets'
import { planetMaxScale, type FeatureSpec } from '../../planet/planetProfiles'
import type { PlanetImpulseApi } from '../../planet/PlanetCanvas'
import type { CardDefinition } from '../../game/cards/catalog'
import { parsePhysicalStat, useStatCountUp } from './statCountUp'

const PlanetCanvas = lazy(() => import('../../planet/PlanetCanvas').then((m) => ({ default: m.PlanetCanvas })))

interface ObjectViewerProps {
  card: CardDefinition | null
  open: boolean
  onClose: () => void
}

// Horizontal drag spins the body ~1:1 with the finger; vertical drag nudges the gas-giant-only
// polar tilt (uTilt - see gasLayers.ts). Release keeps spinning via flingRotation, which reuses
// PlanetCanvas's existing hit-reaction decay for the coast-to-stop feel.
const DRAG_ROTATE_PER_PX = 0.008
const DRAG_TILT_PER_PX = 0.006
const FLING_SCALE = 0.35
const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.2
const CHIP_HALF_PX = 12

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

function ScanRow({ label, raw, active }: { label: string; raw: string; active: boolean }) {
  const stat = useMemo(() => parsePhysicalStat(raw), [raw])
  const display = useStatCountUp(stat, active)
  return (
    <div className="object-viewer-scan-row">
      <span>{label}</span>
      <span>{display}</span>
    </div>
  )
}

export function ObjectViewer({ card, open, onClose }: ObjectViewerProps) {
  const target = card ? realPlanetByName(card.name) : undefined
  const features: FeatureSpec[] = target?.profile.features ?? []

  const apiRef = useRef<PlanetImpulseApi | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const zoomRef = useRef(1)
  const [scanActive, setScanActive] = useState(false)
  const [openFactId, setOpenFactId] = useState<string | null>(null)

  const drag = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    lastMoveTime: 0,
    lastAngularVel: 0,
    pinchStartDist: 0,
    pinchStartZoom: 1,
  })

  // Positions the fact-chip pins from the live rotation every frame - see the inverse of the
  // rot() math each surface shader (and PlanetCanvas's own crack recording) already uses.
  useEffect(() => {
    if (!open || features.length === 0) return
    const maxScale = target ? planetMaxScale(target.profile) : 1
    let raf = 0
    const step = () => {
      const api = apiRef.current
      const box = boxRef.current
      if (api && box) {
        const rotation = api.getRotation()
        const zoom = zoomRef.current
        const { clientWidth, clientHeight } = box
        const c = Math.cos(rotation)
        const s = Math.sin(rotation)
        for (const f of features) {
          const el = chipRefs.current.get(f.id)
          if (!el) continue
          const dx = f.uv[0] - 0.5
          const dy = f.uv[1] - 0.5
          const vx = c * dx + s * dy
          const vy = -s * dx + c * dy
          const px = (0.5 + (vx * zoom) / maxScale) * clientWidth
          const py = (0.5 + (vy * zoom) / maxScale) * clientHeight
          el.style.transform = `translate(${px - CHIP_HALF_PX}px, ${py - CHIP_HALF_PX}px)`
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (drag.current.pointers.size === 2) {
      const [a, b] = [...drag.current.pointers.values()]
      drag.current.pinchStartDist = dist(a.x, a.y, b.x, b.y) || 1
      drag.current.pinchStartZoom = zoomRef.current
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = drag.current.pointers.get(e.pointerId)
    if (!prev) return
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (drag.current.pointers.size >= 2) {
      const [a, b] = [...drag.current.pointers.values()]
      const d = dist(a.x, a.y, b.x, b.y) || 1
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, drag.current.pinchStartZoom * (d / drag.current.pinchStartDist)))
      zoomRef.current = nextZoom
      apiRef.current?.setZoom(nextZoom)
      return
    }

    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    const now = performance.now()
    const dt = drag.current.lastMoveTime ? (now - drag.current.lastMoveTime) / 1000 : 1 / 60
    drag.current.lastMoveTime = now
    const dRot = dx * DRAG_ROTATE_PER_PX
    apiRef.current?.addRotation(dRot)
    apiRef.current?.addTilt(-dy * DRAG_TILT_PER_PX)
    drag.current.lastAngularVel = dt > 0 ? dRot / dt : 0
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current.pointers.delete(e.pointerId)
    if (drag.current.pointers.size === 0) {
      apiRef.current?.flingRotation(drag.current.lastAngularVel * FLING_SCALE)
      drag.current.lastMoveTime = 0
      drag.current.lastAngularVel = 0
    }
  }

  const openFact = features.find((f) => f.id === openFactId) ?? null

  return (
    <Sheet
      open={open}
      onClose={() => {
        setScanActive(false)
        setOpenFactId(null)
        zoomRef.current = 1
        onClose()
      }}
      title={card?.name ?? ''}
    >
      {card && target && (
        <div className="object-viewer">
          <div
            ref={boxRef}
            className="object-viewer-canvas-box"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <Suspense fallback={<div className="card-art card-art-loading object-viewer-canvas" />}>
              <PlanetCanvas profile={target.profile} className="object-viewer-canvas" onReady={(api) => (apiRef.current = api)} />
            </Suspense>
            {scanActive && <div className="object-viewer-scan-sweep" />}
            {features.map((f) => (
              <button
                key={f.id}
                ref={(el) => {
                  if (el) chipRefs.current.set(f.id, el)
                  else chipRefs.current.delete(f.id)
                }}
                className={`object-viewer-chip ${openFactId === f.id ? 'object-viewer-chip--open' : ''}`}
                aria-label={f.label}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenFactId((id) => (id === f.id ? null : f.id))
                }}
              >
                <span className="object-viewer-chip-dot" />
              </button>
            ))}
          </div>
          {openFact && (
            <div className="object-viewer-fact-bubble">
              <div className="object-viewer-fact-label">{openFact.label}</div>
              <div className="object-viewer-fact-text">{openFact.fact}</div>
            </div>
          )}
          <div className="object-viewer-hint">DRAG TO ORBIT · PINCH TO ZOOM{features.length > 0 ? ' · TAP A MARKER' : ''}</div>
          <div className="object-viewer-actions">
            <button
              className="object-viewer-reset-btn"
              onClick={() => {
                zoomRef.current = 1
                apiRef.current?.resetView()
              }}
            >
              RESET VIEW
            </button>
            <button className={`object-viewer-scan-btn ${scanActive ? 'object-viewer-scan-btn--active' : ''}`} onClick={() => setScanActive((v) => !v)}>
              {scanActive ? 'SCANNING...' : 'SCAN'}
            </button>
          </div>
          {scanActive && (
            <div className="object-viewer-scan-table">
              {Object.entries(card.physical).map(([label, value]) => (
                <ScanRow key={label} label={label} raw={value} active={scanActive} />
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
