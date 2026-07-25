import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { xpForPlanetKill, xpToNextLevel } from './TalentXp'

describe('talent tree XP curve', () => {
  const cfg = defaultBalanceConfig

  it('xpForPlanetKill is linear in stage (base + stage*perStage)', () => {
    expect(xpForPlanetKill(1, cfg)).toBe(Math.round(cfg.talentXpBase + 1 * cfg.talentXpPerStage))
    expect(xpForPlanetKill(50, cfg)).toBe(Math.round(cfg.talentXpBase + 50 * cfg.talentXpPerStage))
    // Doubling the stage doesn't double the reward once the flat base is added - confirms this
    // isn't secretly exponential like Stardust/HP.
    const at10 = xpForPlanetKill(10, cfg)
    const at20 = xpForPlanetKill(20, cfg)
    expect(at20).toBeLessThan(at10 * 2)
  })

  it('xpForPlanetKill treats stage <= 0 as stage 1 (never negative/zero XP)', () => {
    expect(xpForPlanetKill(0, cfg)).toBe(xpForPlanetKill(1, cfg))
    expect(xpForPlanetKill(-5, cfg)).toBe(xpForPlanetKill(1, cfg))
  })

  it('xpToNextLevel grows with level (polynomial, not flat)', () => {
    const need1 = xpToNextLevel(1, cfg)
    const need50 = xpToNextLevel(50, cfg)
    const need100 = xpToNextLevel(100, cfg)
    expect(need50).toBeGreaterThan(need1)
    expect(need100).toBeGreaterThan(need50)
  })
})
