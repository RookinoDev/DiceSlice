// Alternate view for the collection: every owned card as a point of light in a pannable,
// zoomable star field (see starMapPosition.ts for where each point sits and why). A plain 2D
// canvas, not WebGL - cheap enough to draw thousands of points a frame, and this project's
// WebGL budget is already spoken for elsewhere (docs/CARD_SYSTEM_PLAN.md's two-context cap).
// Camera state (pan/zoom) lives in a ref and redraws are event-driven (pointer move, resize) -
// there's nothing continuously animating here, so no persistent rAF loop is needed.
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { CardDefinition, CardRarity } from '../../game/cards/catalog'
import { RARITY_COLOR } from './cardTheme'
import { starMapPosition } from './starMapPosition'

interface StarMapViewProps {
  cards: CardDefinition[]
  onSelect: (card: CardDefinition) => void
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5
const TAP_MOVE_THRESHOLD_PX = 6
const TAP_HIT_RADIUS_PX = 16
const DOT_RADIUS: Record<CardRarity, number> = { common: 2, uncommon: 2.3, rare: 2.7, epic: 3.2, legendary: 4, ultra: 4.6 }
const GLOW_RARITIES = new Set<CardRarity>(['legendary', 'ultra'])

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

interface BackgroundStar {
  x: number
  y: number
  r: number
  a: number
}

const BACKGROUND_STAR_COUNT = 220
/** Purely decorative, not card data - generated once with a fixed seed so it's stable across
 *  remounts instead of re-rolling (and visibly jumping) every time this view mounts. */
function makeBackgroundStars(): BackgroundStar[] {
  let seed = 1234567
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  return Array.from({ length: BACKGROUND_STAR_COUNT }, () => ({
    x: (rnd() - 0.5) * 3,
    y: (rnd() - 0.5) * 3,
    r: 0.5 + rnd(),
    a: 0.15 + rnd() * 0.35,
  }))
}

export function StarMapView({ cards, onSelect }: StarMapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundStars = useMemo(makeBackgroundStars, [])
  const points = useMemo(() => cards.map((card) => ({ card, pos: starMapPosition(card) })), [cards])

  // Pan/zoom camera - a ref, not React state, so dragging never re-renders; draw() is called
  // directly after every mutation instead.
  const camera = useRef({ panX: 0, panY: 0, zoom: 1 })
  const drag = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    moved: 0,
    pinchStartDist: 0,
    pinchStartZoom: 1,
    panStart: { x: 0, y: 0, panX: 0, panY: 0 },
  })

  const draw = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#050811'
    ctx.fillRect(0, 0, w, h)

    const { panX, panY, zoom } = camera.current
    const scale = Math.min(w, h) * 0.45 * zoom
    const cx = w / 2 + panX
    const cy = h / 2 + panY

    ctx.fillStyle = '#ffffff'
    for (const s of backgroundStars) {
      const px = cx + s.x * scale * 0.5
      const py = cy + s.y * scale * 0.5
      if (px < -10 || px > w + 10 || py < -10 || py > h + 10) continue
      ctx.globalAlpha = s.a
      ctx.beginPath()
      ctx.arc(px, py, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    for (const { card, pos } of points) {
      const px = cx + pos.x * scale
      const py = cy + pos.y * scale
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue
      const r = DOT_RADIUS[card.rarity] * Math.min(1.6, Math.max(0.6, zoom))
      const color = RARITY_COLOR[card.rarity]
      if (GLOW_RARITIES.has(card.rarity)) {
        const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 4)
        glow.addColorStop(0, `${color}99`)
        glow.addColorStop(1, `${color}00`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(px, py, r * 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  useEffect(() => {
    camera.current = { panX: 0, panY: 0, zoom: 1 }
    draw()
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(draw)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  const handleTap = (px: number, py: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const { panX, panY, zoom } = camera.current
    const scale = Math.min(w, h) * 0.45 * zoom
    const cx = w / 2 + panX
    const cy = h / 2 + panY
    let nearest: CardDefinition | null = null
    let nearestDist = TAP_HIT_RADIUS_PX
    for (const { card, pos } of points) {
      const d = dist(cx + pos.x * scale, cy + pos.y * scale, px, py)
      if (d < nearestDist) {
        nearestDist = d
        nearest = card
      }
    }
    if (nearest) onSelect(nearest)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* best-effort - see CardGridItem.tsx's tilt handler for why this can throw */
    }
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current.moved = 0
    if (drag.current.pointers.size === 1) {
      drag.current.panStart = { x: e.clientX, y: e.clientY, panX: camera.current.panX, panY: camera.current.panY }
    } else if (drag.current.pointers.size === 2) {
      const [a, b] = [...drag.current.pointers.values()]
      drag.current.pinchStartDist = dist(a.x, a.y, b.x, b.y) || 1
      drag.current.pinchStartZoom = camera.current.zoom
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = drag.current.pointers.get(e.pointerId)
    if (!prev) return
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current.moved += dist(prev.x, prev.y, e.clientX, e.clientY)

    if (drag.current.pointers.size >= 2) {
      const [a, b] = [...drag.current.pointers.values()]
      const d = dist(a.x, a.y, b.x, b.y) || 1
      camera.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, drag.current.pinchStartZoom * (d / drag.current.pinchStartDist)))
      draw()
      return
    }
    camera.current.panX = drag.current.panStart.panX + (e.clientX - drag.current.panStart.x)
    camera.current.panY = drag.current.panStart.panY + (e.clientY - drag.current.panStart.y)
    draw()
  }

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const wasTap = drag.current.pointers.size === 1 && drag.current.moved < TAP_MOVE_THRESHOLD_PX
    drag.current.pointers.delete(e.pointerId)
    if (wasTap) {
      const rect = e.currentTarget.getBoundingClientRect()
      handleTap(e.clientX - rect.left, e.clientY - rect.top)
    }
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    camera.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.current.zoom * (e.deltaY < 0 ? 1.12 : 0.89)))
    draw()
  }

  return (
    <div
      ref={wrapRef}
      className="star-map-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onWheel={onWheel}
    >
      <canvas ref={canvasRef} className="star-map-canvas" />
      <div className="star-map-hint">DRAG TO PAN · PINCH OR SCROLL TO ZOOM · TAP A STAR</div>
    </div>
  )
}
