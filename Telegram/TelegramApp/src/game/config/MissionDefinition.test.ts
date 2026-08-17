// Regression test for a real player report: the SAME uncompleted mission's previewed Stardust
// reward (and a just-completed mission's claim reward) swung wildly from moment to moment -
// e.g. "Destroy 1,784 Planets" showed 334M Stardust during a boss encounter and 36.6M seconds
// later on a normal sector, with the wallet/level unchanged in between. Root cause: reward was
// `oneKillGold * rewardMult`, recomputed from the player's CURRENT stage at claim/render time
// (oneKillGold spikes ~9x on a boss stage - bossGoldMultiplier * sqrt(bossHpMultiplier)). Fixed
// by baking a permanent, deterministic reward into each MissionDefinition at catalog-build time.
import { describe, expect, it } from 'vitest'
import { buildDefaultMissions, rewardForLevel, MissionType } from './MissionDefinition'
import { fromBigNumberData } from '../core/BigNumber'

describe('mission rewards are fixed - never depend on live player/session state', () => {
  it('rewardForLevel is a pure function: same (weight, level) always yields the same reward', () => {
    const a = rewardForLevel(4, 12)
    const b = rewardForLevel(4, 12)
    expect(a.toNumber()).toBeCloseTo(b.toNumber(), 6)
  })

  it('buildDefaultMissions is deterministic across independent calls (no hidden live coupling)', () => {
    const first = buildDefaultMissions()
    const second = buildDefaultMissions()
    for (let i = 0; i < first.length; i++) {
      expect(fromBigNumberData(second[i].reward).toNumber()).toBeCloseTo(fromBigNumberData(first[i].reward).toNumber(), 6)
    }
  })

  it('every mission has a finite, positive reward', () => {
    for (const def of buildDefaultMissions()) {
      const n = fromBigNumberData(def.reward).toNumber()
      expect(Number.isFinite(n)).toBe(true)
      expect(n).toBeGreaterThan(0)
    }
  })

  it('reward strictly increases with level within every template - a harder mission never pays less', () => {
    const missions = buildDefaultMissions()
    const byType = new Map<MissionType, typeof missions>()
    for (const def of missions) {
      if (!byType.has(def.type)) byType.set(def.type, [])
      byType.get(def.type)!.push(def)
    }
    for (const [, chain] of byType) {
      chain.sort((a, b) => a.level - b.level)
      for (let i = 1; i < chain.length; i++) {
        const prev = fromBigNumberData(chain[i - 1].reward).toNumber()
        const cur = fromBigNumberData(chain[i].reward).toNumber()
        expect(cur).toBeGreaterThan(prev)
      }
    }
  })

  it('rare/high-effort templates (Prestige, DestroyBosses) pay more at the same level than frequent ones (TapCount)', () => {
    const missions = buildDefaultMissions()
    const at = (type: MissionType, level: number) => fromBigNumberData(missions.find((m) => m.type === type && m.level === level)!.reward).toNumber()
    expect(at(MissionType.Prestige, 10)).toBeGreaterThan(at(MissionType.TapCount, 10))
    expect(at(MissionType.DestroyBosses, 10)).toBeGreaterThan(at(MissionType.DestroyPlanets, 10))
  })
})
