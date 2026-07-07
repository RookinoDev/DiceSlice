// Record-Breaking Hit Celebration (#60) - tracks the player's single biggest tap ever, purely
// for a "new record" flourish. Deliberately NOT threaded through the core SaveState/SaveBinder
// pipeline (it doesn't affect gameplay, isn't a Crit - see the plan's note on the deterministic
// damage pipeline - just a presentational personal-best), so it lives in its own small
// localStorage entry instead of touching core persistence code.
import { useRef } from 'react'
import { BigNumber } from '../game/core/BigNumber'

const STORAGE_KEY = 'stellarbreaker.bestTapDamage.v1'

function load(): BigNumber {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return BigNumber.Zero
    const parsed = JSON.parse(raw) as { mantissa: number; exponent: number }
    return new BigNumber(parsed.mantissa, parsed.exponent)
  } catch {
    return BigNumber.Zero
  }
}

function save(value: BigNumber): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mantissa: value.mantissa, exponent: value.exponent }))
  } catch {
    // best-effort only - a failed write just means no record next time, never blocks gameplay
  }
}

export function useBestHit() {
  const bestRef = useRef<BigNumber | null>(null)
  if (bestRef.current === null) bestRef.current = load()

  /** Returns true (and persists the new best) if this hit beats the previous record. */
  const checkRecord = (damage: BigNumber): boolean => {
    if (bestRef.current === null || damage.lte(bestRef.current)) return false
    bestRef.current = damage
    save(damage)
    return true
  }

  return { checkRecord }
}
