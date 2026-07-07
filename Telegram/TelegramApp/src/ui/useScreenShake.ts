// Toggles a brief shake class on a ref'd element (see .shake-small/.shake-big in ui.css).
// Reserved for impactful moments - regular/boss kills get the small shake, Boss Defeated /
// Prestige success / Ship Unlock additionally get the big one. No-ops under
// prefers-reduced-motion so motion-sensitive players aren't affected.
import { useRef } from 'react'

type ShakeIntensity = 'small' | 'big'

export function useScreenShake<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  const triggerShake = (intensity: ShakeIntensity) => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const className = intensity === 'big' ? 'shake-big' : 'shake-small'
    el.classList.remove('shake-small', 'shake-big')
    void el.offsetWidth // force reflow so the animation restarts even mid-flight
    el.classList.add(className)
  }

  return { ref, triggerShake }
}
