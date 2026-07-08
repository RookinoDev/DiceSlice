import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { createGameSession } from '../createGameSession'
import { applySave, captureSave } from '../persistence/SaveBinder'

const NUKE = new BigNumber(1, 300)

/** Kill the current planet outright (advances the stage). */
function killCurrent(s: ReturnType<typeof createGameSession>) {
  s.enemy.applyDamage(NUKE)
}

describe('lifetime stats', () => {
  it('counts planet kills, boss kills, and tracks deepest stage', () => {
    const s = createGameSession()
    s.begin()
    for (let i = 0; i < 12; i++) killCurrent(s) // crosses the stage-5 and stage-10 bosses (interval 5)
    expect(s.stats.planetsDestroyed).toBe(12)
    expect(s.stats.bossesDefeated).toBe(2)
    expect(s.stats.deepestStage).toBe(13)
  })

  it('survives prestige and counts ascensions', () => {
    const s = createGameSession()
    s.begin()
    while (!s.canPrestige()) killCurrent(s)
    const killsBefore = s.stats.planetsDestroyed
    const deepestBefore = s.stats.deepestStage

    expect(s.doPrestige().gt(BigNumber.Zero)).toBe(true)
    expect(s.stats.prestigeCount).toBe(1)
    expect(s.stats.planetsDestroyed).toBe(killsBefore) // lifetime, not per-run
    expect(s.stats.deepestStage).toBe(deepestBefore) // survives the run reset
    expect(s.stage.highestStage).toBe(1) // ...while run progress did reset
  })

  it('round-trips through the save and seeds legacy saves from highestStage', () => {
    const s = createGameSession()
    s.begin()
    for (let i = 0; i < 5; i++) killCurrent(s)

    const state = captureSave(s)
    expect(state.stats?.planetsDestroyed).toBe(5)

    const restored = createGameSession()
    applySave(restored, state)
    expect(restored.stats.planetsDestroyed).toBe(5)
    expect(restored.stats.deepestStage).toBe(6)

    // Legacy save without stats: infer deepest stage + first-played from what exists.
    const legacy = { ...state, stats: undefined, highestStage: 33, lastSaveUnixSeconds: 1_700_000_000 }
    const veteran = createGameSession()
    applySave(veteran, legacy)
    expect(veteran.stats.deepestStage).toBe(33)
    expect(veteran.stats.firstPlayedUnixSeconds).toBe(1_700_000_000)
  })
})
