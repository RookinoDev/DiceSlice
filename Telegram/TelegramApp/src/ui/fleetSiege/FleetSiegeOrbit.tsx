// Fleet "Siege Orbit" (docs/FLEET_SIEGE_ORBIT_PLAN.md): owned ships rendered orbiting the
// current planet on the combat screen. All motion/firing logic lives in useFleetSiegeOrbit;
// this component is just the DOM shell it drives. Render as a sibling of `.combat-planet`
// inside `.combat-planet-wrap` - see useFleetSiegeOrbit's stacking-context comment for why
// ship z-index values interleave correctly with the planet without any wrapper tricks.
import { memo, type RefObject } from 'react'
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
  planetScale: number
  bossActive: boolean
  bossSecondsLeft: number
  bossTimerSeconds: number
}

/** Sprite footprint before the per-frame depth scale is applied - later/heavier ships read a touch bigger. */
function spriteSizePx(index: number): number {
  return 15 + Math.min(13, index * 0.65)
}

function FleetSiegeOrbitImpl({ session, planetRef, impulseApiRef, triggerShake, planetScale, bossActive, bossSecondsLeft, bossTimerSeconds }: FleetSiegeOrbitProps) {
  const { visibleIndices, registerSprite, registerRoot, particlesRef } = useFleetSiegeOrbit({
    session,
    planetRef,
    impulseApiRef,
    triggerShake,
    planetScale,
    bossActive,
    bossSecondsLeft,
    bossTimerSeconds,
  })

  return (
    <div ref={registerRoot} className="siege-layer">
      {visibleIndices.map((i) => {
        const tier = shipTierVisualForIndex(i)
        const size = spriteSizePx(i)
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
