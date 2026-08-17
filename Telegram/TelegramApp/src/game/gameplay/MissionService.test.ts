// Companion to MissionDefinition.test.ts: claim() no longer takes a live "oneKillGold" argument
// at all (it can't - claim(i, oneKillGold) was the exact API shape that let the same mission pay
// a different amount depending on when/where it was claimed). These tests lock in the new,
// state-independent contract at the service level.
import { describe, expect, it } from 'vitest'
import { MissionService } from './MissionService'
import { buildDefaultMissions } from '../config/MissionDefinition'
import { CurrencyService } from '../economy/CurrencyService'
import { fromBigNumberData } from '../core/BigNumber'

function makeService() {
  const defs = buildDefaultMissions()
  const wallet = new CurrencyService()
  return { defs, wallet, missions: new MissionService(defs, wallet) }
}

describe('MissionService: claim pays the definition\'s fixed reward, nothing else', () => {
  it('cannot claim before the target is reached', () => {
    const { missions } = makeService()
    expect(missions.isComplete(0)).toBe(false)
    expect(missions.claim(0)).toBe(false)
  })

  it('claiming a completed mission pays exactly its fixed def.reward, regardless of wallet/stage state', () => {
    const { defs, wallet, missions } = makeService()
    missions.notifyPlanetDestroyed()
    for (let i = 1; i < defs[0].target; i++) missions.notifyPlanetDestroyed()
    expect(missions.isComplete(0)).toBe(true)

    const expected = fromBigNumberData(defs[0].reward)
    expect(missions.claim(0)).toBe(true)
    expect(wallet.balance.toNumber()).toBeCloseTo(expected.toNumber(), 4)
    expect(missions.rewardFor(0).toNumber()).toBeCloseTo(expected.toNumber(), 4)
  })

  it('cannot claim the same mission twice', () => {
    const { defs, missions } = makeService()
    for (let i = 0; i < defs[0].target; i++) missions.notifyPlanetDestroyed()
    expect(missions.claim(0)).toBe(true)
    expect(missions.claim(0)).toBe(false)
  })

  it('rewardFor is stable across repeated calls with no arguments to vary', () => {
    const { missions } = makeService()
    const a = missions.rewardFor(5)
    const b = missions.rewardFor(5)
    expect(a.toNumber()).toBeCloseTo(b.toNumber(), 6)
  })
})
