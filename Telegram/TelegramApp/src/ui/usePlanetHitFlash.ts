// Drives the .combat-planet scale-punch/brightness flash (see .combat-planet-hit in ui.css).
// Fires on every player tap and on skill instant-damage (Meteor Strike), not on background
// fleet-DPS ticks (those fire continuously and would just look like flicker, not impact).
import { useEffect, useRef } from 'react'
import type { GameSession } from '../game/gameplay/GameSession'

export function usePlanetHitFlash(session: GameSession) {
  const ref = useRef<HTMLButtonElement | null>(null)

  const pulse = () => {
    const el = ref.current
    if (!el) return
    el.classList.remove('hit')
    void el.offsetWidth // force reflow so the animation restarts even mid-flight
    el.classList.add('hit')
  }

  useEffect(() => {
    return session.onSkillDamage.on(() => pulse())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  return { ref, pulse }
}
