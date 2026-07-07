// Purely cosmetic tap-streak counter for the "xN COMBO" chip - counts consecutive taps within
// a short gap, resets after a pause. Never touches real damage/reward (see GameSession.tap()) -
// this is presentation only, same as the rest of this juice pass.
import { useCallback, useRef, useState } from 'react'

const STREAK_GAP_MS = 600
/** Below this many ms since the last tap, the chip starts visibly fading (Combo Almost Lost). */
const FADE_START_MS = 350
const ESCALATION_STEP = 10
/** How many recent inter-tap gaps to compare for the rhythm bonus. */
const RHYTHM_SAMPLE = 4
/** Gaps within this fraction of their own average count as "consistent". */
const RHYTHM_TOLERANCE = 0.18

export function useTapStreak() {
  const [count, setCount] = useState(0)
  const [fading, setFading] = useState(false)
  const [inRhythm, setInRhythm] = useState(false)
  const streakRef = useRef(0)
  const lastTapAt = useRef(0)
  const recentGaps = useRef<number[]>([])
  const fadeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /** Call on every tap. Returns the resulting streak count synchronously (React state updates
   *  are async, so callers that need to react to the new count in the same tick - e.g. the
   *  combo sound ladder - can't just read the hook's `count` right after calling this) plus
   *  whether this tap landed on the 10-tap haptic-escalation milestone. */
  const registerTap = useCallback(() => {
    const now = performance.now()
    const gap = now - lastTapAt.current
    lastTapAt.current = now

    const next = gap > STREAK_GAP_MS ? 1 : streakRef.current + 1
    streakRef.current = next
    setCount(next)
    setFading(false)

    if (gap <= STREAK_GAP_MS) {
      recentGaps.current = [...recentGaps.current, gap].slice(-RHYTHM_SAMPLE)
    } else {
      recentGaps.current = []
    }
    if (recentGaps.current.length >= RHYTHM_SAMPLE) {
      const avg = recentGaps.current.reduce((a, b) => a + b, 0) / recentGaps.current.length
      setInRhythm(recentGaps.current.every((g) => Math.abs(g - avg) <= avg * RHYTHM_TOLERANCE))
    } else {
      setInRhythm(false)
    }

    clearTimeout(fadeTimeout.current)
    clearTimeout(resetTimeout.current)
    fadeTimeout.current = setTimeout(() => setFading(true), FADE_START_MS)
    resetTimeout.current = setTimeout(() => {
      streakRef.current = 0
      setCount(0)
      setFading(false)
      setInRhythm(false)
      recentGaps.current = []
    }, STREAK_GAP_MS)

    return { count: next, isMilestone: next > 0 && next % ESCALATION_STEP === 0 }
  }, [])

  return { count, fading, inRhythm, registerTap }
}
