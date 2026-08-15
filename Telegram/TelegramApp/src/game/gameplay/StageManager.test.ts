import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { StageManager } from './StageManager'

describe("StageManager: setBossTimerMultiplier (Warp Command's real identity)", () => {
  it('scales how long a boss fight timer runs before it fails', () => {
    const stage = new StageManager(defaultBalanceConfig, defaultBalanceConfig.bossStageInterval) // stage 1 of a boss cycle
    stage.setBossTimerMultiplier(1.5)
    stage.begin()

    // Full timer should be 1.5x the base - tick just short of the un-boosted base and confirm
    // the boss hasn't failed yet (it would have, without the multiplier).
    let failed = false
    stage.onBossFailed.on(() => (failed = true))
    stage.tick(defaultBalanceConfig.bossTimerSeconds * 1.4)
    expect(failed).toBe(false)

    stage.tick(defaultBalanceConfig.bossTimerSeconds * 0.2) // now past the boosted 1.5x total
    expect(failed).toBe(true)
  })

  it('clamps below 1x to exactly 1x - a bonus can only help, never shrink the timer', () => {
    const stage = new StageManager(defaultBalanceConfig, defaultBalanceConfig.bossStageInterval)
    stage.setBossTimerMultiplier(0.1)
    stage.begin()
    let failed = false
    stage.onBossFailed.on(() => (failed = true))
    stage.tick(defaultBalanceConfig.bossTimerSeconds * 0.99)
    expect(failed).toBe(false) // still using the full base timer, not the sub-1x value
  })
})
