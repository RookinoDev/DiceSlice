// Smoothly chases a moving BigNumber target instead of snapping to it - a rolling-odometer
// currency feel. Uses one persistent rAF loop (not a per-change restart) since the game loop
// re-renders every animation frame during passive income, and a naive "cancel + restart a
// fixed-duration tween on every target change" would fight that and never get to paint.
// Visual only - the loop's own float math is never the source of truth, it just chases the
// real BigNumber and snaps exactly onto it once close enough.
import { useEffect, useRef, useState } from 'react'
import { BigNumber } from '../game/core/BigNumber'

// Per-second exponential catch-up rate - higher chases a moving target faster.
const CATCH_UP_RATE = 8

export function useCountUp(target: BigNumber): BigNumber {
  const [displayed, setDisplayed] = useState(target)
  const targetRef = useRef(target)
  const displayedRef = useRef(target)
  const lastRef = useRef(0)
  targetRef.current = target

  useEffect(() => {
    let raf: number

    const step = (now: number) => {
      const dt = lastRef.current ? Math.min(0.1, (now - lastRef.current) / 1000) : 0
      lastRef.current = now

      const from = displayedRef.current.toNumber()
      const to = targetRef.current.toNumber()
      const diff = to - from

      let next = displayedRef.current
      if (dt > 0 && diff !== 0) {
        const closeEnough = Math.abs(diff) < Math.max(1, Math.abs(to)) * 1e-4
        next = closeEnough ? targetRef.current : new BigNumber(from + diff * (1 - Math.exp(-CATCH_UP_RATE * dt)))
      }

      if (!next.eq(displayedRef.current)) {
        displayedRef.current = next
        setDisplayed(next)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => cancelAnimationFrame(raf)
  }, [])

  return displayed
}
