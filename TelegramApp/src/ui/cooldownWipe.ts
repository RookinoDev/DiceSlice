import type { CSSProperties } from 'react'

/** Conic-gradient dark overlay masking a circular icon proportional to time remaining. */
export function cooldownWipeStyle(secondsLeft: number, totalSeconds: number): CSSProperties {
  if (!secondsLeft || secondsLeft <= 0 || totalSeconds <= 0) return { display: 'none' }
  const pct = Math.max(0, Math.min(1, secondsLeft / totalSeconds))
  const angle = Math.round(pct * 360)
  return {
    background: `conic-gradient(rgba(8,10,20,0.86) ${angle}deg, transparent ${angle}deg)`,
  }
}
