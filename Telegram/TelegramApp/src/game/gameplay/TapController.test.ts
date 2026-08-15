import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { EnemyController } from './EnemyController'
import { StageManager } from './StageManager'
import { TapController } from './TapController'
import { TapDamageUpgrade } from './TapDamageUpgrade'

function freshController(critChance: number, critDamageMultiplier: BigNumber) {
  const stage = new StageManager(defaultBalanceConfig, 1)
  const enemy = new EnemyController(stage) // must be constructed before begin() to catch onStageEntered
  stage.begin()
  const tapDamage = new TapDamageUpgrade(defaultBalanceConfig)
  const taps = new TapController(enemy, tapDamage, undefined, () => critChance, () => critDamageMultiplier)
  return taps
}

describe("TapController: critDamageMultiplier (Vanguard Cannon's real identity)", () => {
  it('stacks on top of the flat TAP_CRIT_DAMAGE_MULTIPLIER only on a crit hit', () => {
    const base = freshController(1, BigNumber.One) // critChance=1 forces every tap to crit
    let baseDamage = 0
    base.onDamageDealt.on((e) => (baseDamage = e.amount.toNumber()))
    base.tap()

    const boosted = freshController(1, new BigNumber(2))
    let boostedDamage = 0
    boosted.onDamageDealt.on((e) => (boostedDamage = e.amount.toNumber()))
    boosted.tap()

    expect(boostedDamage).toBeCloseTo(baseDamage * 2, 6)
  })

  it('never applies on a non-crit tap', () => {
    const taps = freshController(0, new BigNumber(10)) // critChance=0, would be huge if misapplied
    const noBoost = freshController(0, BigNumber.One)
    let withMultiplier = 0
    let without = 0
    taps.onDamageDealt.on((e) => (withMultiplier = e.amount.toNumber()))
    noBoost.onDamageDealt.on((e) => (without = e.amount.toNumber()))
    taps.tap()
    noBoost.tap()
    expect(withMultiplier).toBeCloseTo(without, 6)
  })
})
