import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { buildPrototypeSkills, SkillType } from '../config/SkillDefinition'
import { defaultBalanceConfig } from '../config/BalanceConfig'
import { SkillService } from './SkillService'

function freshService(): SkillService {
  return new SkillService(buildPrototypeSkills(defaultBalanceConfig), () => 99) // player level always high enough to unlock everything
}

describe('SkillService: Core Engine talent hooks (duration/power) actually move real skill behavior', () => {
  it('setDurationMultiplier stretches how long a timed skill stays active', () => {
    const s = freshService()
    const baseDuration = s.fullDuration(SkillType.Overdrive)
    s.setDurationMultiplier(1.5)
    s.activate(SkillType.Overdrive, BigNumber.One)
    expect(s.activeTimeLeft(SkillType.Overdrive)).toBeCloseTo(baseDuration * 1.5, 6)
  })

  it('setSkillPowerMultiplier scales a timed skill\'s effectValue()', () => {
    const s = freshService()
    const base = s.effectValue(SkillType.Overdrive)
    s.setSkillPowerMultiplier(1.25)
    expect(s.effectValue(SkillType.Overdrive)).toBeCloseTo(base * 1.25, 6)
  })

  it('setSkillPowerMultiplier also scales Meteor Call\'s instant damage, not just timed skills', () => {
    const s = freshService()
    const tapDamage = new BigNumber(100)
    const baseDamage = s.activate(SkillType.MeteorStrike, tapDamage).toNumber()
    const s2 = freshService()
    s2.setSkillPowerMultiplier(2)
    const boostedDamage = s2.activate(SkillType.MeteorStrike, tapDamage).toNumber()
    expect(boostedDamage).toBeCloseTo(baseDamage * 2, 6)
  })

  it('setCooldownReduction shortens the cooldown applied on activation, clamped to 90%', () => {
    const s = freshService()
    s.setCooldownReduction(0.5)
    s.activate(SkillType.Overdrive, BigNumber.One)
    expect(s.cooldown(SkillType.Overdrive)).toBeCloseTo(s.fullCooldown(SkillType.Overdrive) * 0.5, 6)

    const s2 = freshService()
    s2.setCooldownReduction(5) // way over 1 - must clamp, never a negative or zero cooldown
    s2.activate(SkillType.Overdrive, BigNumber.One)
    expect(s2.cooldown(SkillType.Overdrive)).toBeCloseTo(s2.fullCooldown(SkillType.Overdrive) * 0.1, 6)
  })
})
