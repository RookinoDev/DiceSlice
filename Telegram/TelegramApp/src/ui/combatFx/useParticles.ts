// Lightweight DOM particle system - deliberately NOT React state driven (taps can spawn many
// particles per second; re-rendering React for each would be wasteful for purely-visual,
// fire-and-forget elements). Particles are raw DOM nodes appended to a ref'd container and
// self-removed via a timeout matching their own animation duration.
import { useCallback, useRef, type CSSProperties } from 'react'

export interface ParticleSpec {
  /** CSS class driving the particle's shape/animation (see combatFx.css). */
  className: string
  /** Spawn position in px, relative to the particle layer's own box. */
  x: number
  y: number
  /** Extra inline style - typically CSS custom properties like --tx/--ty/--rot consumed by the class's keyframes. */
  style?: CSSProperties
  durationMs: number
}

/** Dynamic Visual Clutter Control (#62) - past this many live particles in one layer, new
 *  spawns are dropped. High enough that normal play never hits it; only pathological bursts
 *  (mega overkill during overdrive during a combo) get trimmed, keeping frame times stable. */
const MAX_LIVE_PARTICLES = 80

export function useParticles() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const spawn = useCallback((spec: ParticleSpec) => {
    const container = containerRef.current
    if (!container) return
    if (container.childElementCount >= MAX_LIVE_PARTICLES) return
    const el = document.createElement('div')
    el.className = spec.className
    el.style.left = `${spec.x}px`
    el.style.top = `${spec.y}px`
    if (spec.style) Object.assign(el.style, spec.style as Record<string, string>)
    container.appendChild(el)
    setTimeout(() => el.remove(), spec.durationMs)
  }, [])

  return { containerRef, spawn }
}
