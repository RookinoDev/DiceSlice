// Container for the DOM particle system (see useParticles.ts). Render once per screen that
// needs particles, pass its containerRef down. Sits above the planet but below functional UI -
// give callers' particle classes z-index 1 if they need to clear the planet's ring bleed.
import type { Ref } from 'react'

interface ParticleLayerProps {
  containerRef: Ref<HTMLDivElement>
  /** Extra class for layer-specific stacking (e.g. the shell-level reward layer needs to clear
   *  the top bar, unlike the combat-local one which only needs to clear the planet). */
  className?: string
}

export function ParticleLayer({ containerRef, className }: ParticleLayerProps) {
  return <div ref={containerRef} className={`fx-particle-layer ${className ?? ''}`} />
}
