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

// Ceremony start-to-active takes BEAT_MS*3+350ms (~800ms) - the safety net below is deliberately
// much longer so it never races the real sequence, only catches genuinely stuck cases.
const CEREMONY_MAX_MS = 2500

export function useOverdriveJuice(s: GameSession) {
  // Bug fix: mounting always started at 'idle' regardless of the REAL skill's current state, so
  // switching tabs mid-buff (unmounting CombatScreen) and back lost all cosmetic feedback for
  // the remainder of that buff window - sync from the real session on first mount instead of
  // assuming nothing is happening.
  const [phase, setPhase] = useState<OverdrivePhase>(() => (s.skills.isActive(SkillType.Overdrive) ? 'active' : 'idle'))
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
    // Belt-and-suspenders: whatever else happens (a race we haven't found, a browser timer
    // getting coalesced/dropped after the tab was backgrounded, ...), the countdown text can
    // never visibly stick around longer than this - always resolves to a clean resting state.
    const armSafetyNet = () => {
      after(CEREMONY_MAX_MS, () => {
        setCountdownText('')
        setPhase(s.skills.isActive(SkillType.Overdrive) ? 'active' : 'idle')
      })
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
        armSafetyNet()
      }),
      s.skills.onExpired.on((t) => {
        if (t !== SkillType.Overdrive) return
        clearAllTimeouts()
        setPhase('ending')
        setCountdownText('')
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
