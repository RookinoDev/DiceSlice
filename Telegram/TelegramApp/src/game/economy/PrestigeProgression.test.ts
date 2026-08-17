// Regression test for a real balance report: a full simulation (greedy tap+ship buyer within
// each run, then repeated Stellar Ascensions spending Relics on Artifacts via the real
// ArtifactService/UpgradeCost formulas) showed players got PERMANENTLY stuck at stage 25 after
// just ~2 Ascensions - 12,000+ Relics spent with zero further progress, because
// ArtifactService.multiplier() is linear-in-level while enemyHpForStage compounds exponentially
// per stage forever. See BalanceConfig.ts's enemyHpGrowth/artifactCostGrowth comments for the
// full numeric audit (the boss-multiplier CYCLE itself was found to be well-designed and is
// untouched here).
//
// This test encodes the actual invariant that broke - not a re-run of the full multi-cycle
// simulation (slow, and would need updating every time unrelated balance numbers move) - using
// the real ArtifactService/CurrencyService/UpgradeCost code paths, not reimplemented formulas.
// Compares against the OLD (pre-fix) constants rather than a guessed absolute number, so the
// test is self-consistent and directly proves "meaningfully better," not just "some number."
import { describe, expect, it } from 'vitest'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { buildDefaultArtifacts } from '../config/ArtifactDefinition'
import { ArtifactService } from '../gameplay/ArtifactService'
import { CurrencyService } from './CurrencyService'
import { BigNumber } from '../core/BigNumber'
import type { BalanceConfig } from '../config/BalanceConfig'

const OLD_CFG: BalanceConfig = { ...defaultBalanceConfig, artifactCostGrowth: 1.5, artifactFirstLevelBonus: 0.2, artifactBonusPerLevel: 0.04 }

function dpsMultiplierFor(cfg: BalanceConfig, relicSpend: number): number {
  const relics = new CurrencyService()
  const artifacts = new ArtifactService(buildDefaultArtifacts(cfg), relics)
  relics.add(new BigNumber(relicSpend))
  artifacts.buyOrUpgradeMax(0, { highestStage: 999, prestigeCount: 999 }) // Singularity Core (Dps)
  return artifacts.dpsMultiplier().toNumber()
}

describe('a realistic Relic investment can meaningfully outpace enemy HP growth (not just plateau)', () => {
  it('the same Relic spend buys a dramatically bigger Dps multiplier under the fixed constants than the old ones', () => {
    const RELIC_SPEND = 100_000
    const fixed = dpsMultiplierFor(defaultBalanceConfig, RELIC_SPEND)
    const old = dpsMultiplierFor(OLD_CFG, RELIC_SPEND)

    // Post-fix, the same spend must be meaningfully more effective - proving Relics buy REAL
    // further reach now, not a diminishing fraction of a fraction. 3x is a validated floor: the
    // measured ratio ranges ~3.1x (small spends) to ~5.2x (huge spends) across the whole
    // realistic range, consistent with the full multi-cycle simulation's ~3.4x extended reach
    // (stage 25 -> 85). (The absolute "old" value isn't asserted directly - it drifts with
    // unrelated formula details - only that fixed is a real multiple of it.)
    expect(fixed).toBeGreaterThan(old * 3)
  })

  it('artifact cost growth is gentle enough that levels keep getting bought, not stuck after a handful', () => {
    const cfg = defaultBalanceConfig
    const relics = new CurrencyService()
    const artifacts = new ArtifactService(buildDefaultArtifacts(cfg), relics)
    const ctx = { highestStage: 999, prestigeCount: 999 }

    relics.add(new BigNumber(1_000_000))
    const bought = artifacts.buyOrUpgradeMax(0, ctx)
    // Pre-fix (artifactCostGrowth 1.5x/level), 1M Relics bought well under 20 levels of the
    // cheapest artifact. Post-fix (1.05x/level) the same spend should buy dozens+.
    expect(bought).toBeGreaterThan(40)
  })
})
