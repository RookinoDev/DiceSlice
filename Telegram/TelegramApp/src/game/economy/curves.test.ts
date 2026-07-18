import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { buildDefaultShips } from '../config/ShipDefinition'
import { enemyHpForStage, enemyHpBossForStage } from './EnemyHp'
import { goldRewardForStage } from './GoldReward'
import { tapDamageForLevelCfg } from './TapDamageCurve'
import { upgradeCostExponential } from './UpgradeCost'
import { shipCooldown, shipHitDamage } from './ShipCombat'

// Spot-checks against the formulas documented in the Unity BalanceConfig/ShipCatalog
// comments, computed independently here rather than by calling the same code path,
// to catch porting mistakes rather than just re-asserting the implementation.

describe('economy curves match the documented Unity formulas', () => {
  const cfg = defaultBalanceConfig

  it('enemy HP: HP(stage) = base * growth^(stage-1)', () => {
    expect(enemyHpForStage(1, cfg.enemyHpBase, cfg.enemyHpGrowth).toNumber()).toBeCloseTo(29.0, 6)
    expect(enemyHpForStage(10, cfg.enemyHpBase, cfg.enemyHpGrowth).toNumber()).toBeCloseTo(
      29.0 * Math.pow(1.57, 9),
      3,
    )
  })

  it('boss HP multiplies by the stage boss multiplier', () => {
    expect(enemyHpBossForStage(5, cfg.enemyHpBase, cfg.enemyHpGrowth, 2).toNumber()).toBeCloseTo(
      enemyHpForStage(5, cfg.enemyHpBase, cfg.enemyHpGrowth).toNumber() * 2,
      3,
    )
  })

  it('gold reward: gold(stage) = base * growth^(stage-1)', () => {
    expect(goldRewardForStage(1, cfg.goldBase, cfg.goldGrowth).toNumber()).toBeCloseTo(5.0, 6)
    expect(goldRewardForStage(20, cfg.goldBase, cfg.goldGrowth).toNumber()).toBeCloseTo(
      5.0 * Math.pow(1.15, 19),
      2,
    )
  })

  it('tap damage at level 1 equals the base', () => {
    expect(tapDamageForLevelCfg(1, cfg).toNumber()).toBeCloseTo(cfg.tapDamageBase, 6)
  })

  it('tap damage grows monotonically with level', () => {
    const l1 = tapDamageForLevelCfg(1, cfg).toNumber()
    const l10 = tapDamageForLevelCfg(10, cfg).toNumber()
    const l50 = tapDamageForLevelCfg(50, cfg).toNumber()
    expect(l10).toBeGreaterThan(l1)
    expect(l50).toBeGreaterThan(l10)
  })

  it('tap-damage upgrade cost: cost(n) = base * growth^(n-1)', () => {
    expect(upgradeCostExponential(1, cfg.tapUpgradeBaseCost, cfg.tapUpgradeCostGrowth).toNumber()).toBeCloseTo(10.0, 6)
    expect(upgradeCostExponential(5, cfg.tapUpgradeBaseCost, cfg.tapUpgradeCostGrowth).toNumber()).toBeCloseTo(
      10.0 * Math.pow(1.12, 4),
      4,
    )
  })

  it('ship roster has 19 ships with the documented first-ship base cost', () => {
    const ships = buildDefaultShips()
    expect(ships).toHaveLength(cfg.shipCount)
    expect(ships[0].baseCost).toBe(50)
    expect(ships[0].baseDps).toBe(8)
  })

  it('ship cooldown drops at breakpoints and floors at the configured minimum', () => {
    const baseCd = 0.5
    expect(shipCooldown(1, baseCd, cfg.shipCooldownBreakpoints, cfg.shipCooldownFactor, cfg.shipCooldownMin)).toBeCloseTo(baseCd, 6)
    const at100 = shipCooldown(100, baseCd, cfg.shipCooldownBreakpoints, cfg.shipCooldownFactor, cfg.shipCooldownMin)
    expect(at100).toBeCloseTo(Math.max(cfg.shipCooldownMin, baseCd * 0.85), 6)
  })

  it('ship hit damage applies milestone multipliers at configured levels', () => {
    const below = shipHitDamage(24, 2.5, cfg.shipDamagePerLevel, cfg.shipMilestoneLevels, cfg.shipMilestoneMultipliers).toNumber()
    const at25 = shipHitDamage(25, 2.5, cfg.shipDamagePerLevel, cfg.shipMilestoneLevels, cfg.shipMilestoneMultipliers).toNumber()
    // level 25 crosses the first milestone (x2), so damage should jump by roughly that factor
    // beyond the plain per-level growth between levels 24 and 25.
    const plainGrowthOnly = below * cfg.shipDamagePerLevel
    expect(at25).toBeCloseTo(plainGrowthOnly * 2, 6)
  })
})
