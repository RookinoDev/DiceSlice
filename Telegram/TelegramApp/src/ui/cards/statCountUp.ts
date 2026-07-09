// SCAN stat reveal (docs/CARD_SYSTEM_PLAN.md §5): CardDefinition.physical values are display-
// ready strings like "69,911 km" or "4.15M Suns", not raw numbers, and some fields are
// qualitative ("Confirmed", "Retrograde") with no number at all. Rather than trying to resolve
// every unit/multiplier to a true magnitude (fragile, and a wrong "M"->1e6 parse would show a
// confidently incorrect number), this only extracts the leading digits actually printed and
// counts those up - the animation always lands on exactly the catalog's original text.
import { useEffect, useRef, useState } from 'react'

export interface ParsedStat {
  hasNumber: boolean
  prefix: string
  target: number
  decimals: number
  suffix: string
  raw: string
}

const STAT_NUMBER_RE = /^(~?)([\d,]+(?:\.\d+)?)(.*)$/

export function parsePhysicalStat(raw: string): ParsedStat {
  const m = STAT_NUMBER_RE.exec(raw.trim())
  if (!m) return { hasNumber: false, prefix: '', target: 0, decimals: 0, suffix: '', raw }
  const [, prefix, numStr, suffix] = m
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0
  return { hasNumber: true, prefix, target: parseFloat(numStr.replace(/,/g, '')), decimals, suffix, raw }
}

function formatStat(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const SCAN_DURATION_MS = 900

/** Eases a parsed stat's digits from 0 up to its printed value once `active` flips true (the
 *  SCAN sweep reveal) - a one-shot duration-based ease-out, unlike useCountUp's persistent
 *  moving-target chase, since a card's physical stats never change mid-view. Non-numeric stats
 *  ("Confirmed", "Retrograde"...) pass through unanimated. */
export function useStatCountUp(stat: ParsedStat, active: boolean): string {
  const [progress, setProgress] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stat.hasNumber) return
    if (!active) {
      startRef.current = null
      setProgress(0)
      return
    }
    let raf = 0
    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const t = Math.min(1, (now - startRef.current) / SCAN_DURATION_MS)
      setProgress(1 - Math.pow(1 - t, 3))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, stat.hasNumber])

  if (!stat.hasNumber) return stat.raw
  return `${stat.prefix}${formatStat(stat.target * progress, stat.decimals)}${stat.suffix}`
}
