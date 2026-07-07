// Cosmetic state machine riding the *real* SkillType.Overdrive active window (genuinely
// boosts tap damage - see SkillService.tapDamageMultiplier) - the "Frenzy" wishlist items
// reframed onto a real mechanic instead of inventing one. Never touches damage/cooldown timing,
// only decorates it: a fast "3-2-1-OVERDRIVE" flourish on activation, then a background/particle
// intensity flag for the rest of the real buff window, with a final-blast beat on natural expiry.
import { useEffect, useRef, useState } from 'react'
import type { GameSession } from '../game/gameplay/GameSession'
import { SkillType } from '../game/config/SkillDefinition'
import { audio } from '../game/audio/AudioManager'

export type OverdrivePhase = 'idle' | 'countdown' | 'active' | 'ending'

const BEAT_MS = 150

export function useOverdriveJuice(s: GameSession) {
  const [phase, setPhase] = useState<OverdrivePhase>('idle')
  const [countdownText, setCountdownText] = useState('')
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const clearAllTimeouts = () => {
      timeouts.current.forEach(clearTimeout)
      timeouts.current = []
    }
    const after = (ms: number, fn: () => void) => {
      timeouts.current.push(setTimeout(fn, ms))
    }

    const offs = [
      s.skills.onActivated.on((t) => {
        if (t !== SkillType.Overdrive) return
        clearAllTimeouts()
        setPhase('countdown')
        setCountdownText('3')
        audio.overdriveStart()
        audio.overdriveBeat()
        after(BEAT_MS, () => {
          setCountdownText('2')
          audio.overdriveBeat()
        })
        after(BEAT_MS * 2, () => {
          setCountdownText('1')
          audio.overdriveBeat()
        })
        after(BEAT_MS * 3, () => {
          setCountdownText('OVERDRIVE')
          audio.overdriveGo()
        })
        after(BEAT_MS * 3 + 350, () => {
          setPhase('active')
          setCountdownText('')
        })
      }),
      s.skills.onExpired.on((t) => {
        if (t !== SkillType.Overdrive) return
        clearAllTimeouts()
        setPhase('ending')
        audio.overdriveEnd()
        after(400, () => setPhase('idle'))
      }),
    ]
    return () => {
      offs.forEach((off) => off())
      clearAllTimeouts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  return { phase, countdownText }
}
