// Fleet "Siege Orbit" (docs/FLEET_SIEGE_ORBIT_PLAN.md): owned ships rendered orbiting the
// current planet on the combat screen. All motion/firing logic lives in useFleetSiegeOrbit;
// this component is just the DOM shell it drives. Render as a sibling of `.combat-planet`
// inside `.combat-planet-wrap` - see useFleetSiegeOrbit's stacking-context comment for why
// ship z-index values interleave correctly with the planet without any wrapper tricks.
import { memo, useMemo, type RefObject } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import type { PlanetImpulseApi } from '../../planet/PlanetCanvas'
import { shipTierVisualForIndex } from '../shipTierVisuals'
import { ParticleLayer } from '../combatFx/ParticleLayer'
import { useFleetSiegeOrbit } from './useFleetSiegeOrbit'

interface FleetSiegeOrbitProps {
  session: GameSession
  planetRef: RefObject<HTMLElement | null>
  impulseApiRef: RefObject<PlanetImpulseApi | null>
  triggerShake: (intensity: 'small' | 'big') => void
  bossActive: boolean
  bossSecondsLeft: number
  bossTimerSeconds: number
}

/** Sprite footprint before the per-frame depth scale is applied - later/heavier ships read a touch bigger. */
function spriteSizePx(index: number): number {
  return 15 + Math.min(13, index * 0.65)
}

// Real ship art, keyed by ship index - only ships with an entry here render their actual
// sprite; everything else still falls back to the tier clip-path silhouette. Source art must
// face "up" (nose at the top of the image) - that's the 0deg convention useFleetSiegeOrbit's
// facingDeg math already assumes (matches the placeholder triangles' point-up shape).
const SHIP_ART: Partial<Record<number, string>> = {
  0: '/ships/interceptor-01.png',
}

function FleetSiegeOrbitImpl({ session, planetRef, impulseApiRef, triggerShake, bossActive, bossSecondsLeft, bossTimerSeconds }: FleetSiegeOrbitProps) {
  const { visibleIndices, registerSprite, registerRoot, registerTrail, trailPoolSize, particlesRef } = useFleetSiegeOrbit({
    session,
    planetRef,
    impulseApiRef,
    triggerShake,
    bossActive,
    bossSecondsLeft,
    bossTimerSeconds,
  })

  // Fixed-size pool, indices never change identity - a stable array to map over without
  // reallocating one every render (the actual particle slots live in the hook, this is just
  // "how many <div>s to render", computed once).
  const trailSlots = useMemo(() => Array.from({ length: trailPoolSize }, (_, i) => i), [trailPoolSize])

  return (
    <div ref={registerRoot} className="siege-layer">
      {trailSlots.map((i) => (
        <div key={`trail-${i}`} ref={registerTrail(i)} className="siege-trail" />
      ))}
      {visibleIndices.map((i) => {
        const tier = shipTierVisualForIndex(i)
        const size = spriteSizePx(i)
        const art = SHIP_ART[i]
        if (art) {
          return (
            <img
              key={i}
              ref={registerSprite(i)}
              className="siege-ship siege-ship--art"
              src={art}
              alt=""
              draggable={false}
              style={{ width: size * 3.2, height: size * 3.2, filter: `drop-shadow(0 0 ${Math.round(size * 0.4)}px ${tier.color})` }}
            />
          )
        }
        return (
          <div
            key={i}
            ref={registerSprite(i)}
            className="siege-ship"
            style={{ width: size, height: size, clipPath: tier.clipPath, background: tier.color, boxShadow: `0 0 ${Math.round(size * 0.5)}px ${tier.color}` }}
          />
        )
      })}
      <ParticleLayer containerRef={particlesRef} />
    </div>
  )
}

export const FleetSiegeOrbit = memo(FleetSiegeOrbitImpl)
