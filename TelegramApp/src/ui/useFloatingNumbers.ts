// Lightweight version of the floating-number feedback from GameShellView.cs's OnHit/OnReward
// (SpawnFloating/CreateFloater pool). Skips camera shake and audio - those are M4/M5 concerns.
import { useEffect, useRef, useState } from 'react'
import type { GameSession } from '../game/gameplay/GameSession'

export interface FloatingEntry {
  id: number
  text: string
  color: string
  x: number
  life: number
}

const TAP_COLOR = '#fff299'
const FLEET_COLOR = '#8cd9ff'
const SKILL_COLOR = '#ff8c33'
const REWARD_COLOR = 'var(--palette-success)'

export function useFloatingNumbers(session: GameSession) {
  const [entries, setEntries] = useState<FloatingEntry[]>([])
  const nextId = useRef(0)

  const spawn = (text: string, color: string, life = 0.9) => {
    const id = nextId.current++
    const x = Math.random() * 60 - 30
    setEntries((prev) => [...prev, { id, text, color, x, life }])
    setTimeout(() => setEntries((prev) => prev.filter((e) => e.id !== id)), life * 1000)
  }

  useEffect(() => {
    const offs = [
      session.taps.onDamageDealt.on((e) => spawn(e.amount.toShortString(), TAP_COLOR)),
      session.ships.onShipHit.on((e) => spawn(e.damage.toShortString(), FLEET_COLOR, 0.5)),
      session.onSkillDamage.on((dmg) => spawn(`⚡${dmg.toShortString()}`, SKILL_COLOR, 0.9)),
      session.onReward.on(({ planet, gold }) => {
        const bossSuffix = planet.isBoss ? `  (×${session.stage.bossRewardMultiplier(planet.stage).toFixed(1)} BOSS BONUS)` : ''
        spawn(`+${gold.toShortString()}${bossSuffix}`, REWARD_COLOR, planet.isBoss ? 2.2 : 1.7)
      }),
    ]
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  return entries
}
