import { describe, expect, it, vi } from 'vitest'
import { PASSIVE_PERK_POOL, rollRandomPerk, grantedPerkLabel, passivePerkTemplate } from './PassivePerk'

describe('PASSIVE_PERK_POOL', () => {
  it('every template has a unique id and a valid magnitude range', () => {
    expect(new Set(PASSIVE_PERK_POOL.map((p) => p.id)).size).toBe(PASSIVE_PERK_POOL.length)
    for (const t of PASSIVE_PERK_POOL) {
      expect(t.minMagnitude).toBeGreaterThan(0)
      expect(t.maxMagnitude).toBeGreaterThanOrEqual(t.minMagnitude)
    }
  })
})

describe('rollRandomPerk', () => {
  it('rolls a magnitude within the chosen template\'s own range', () => {
    for (let i = 0; i < 50; i++) {
      const perk = rollRandomPerk()
      const template = passivePerkTemplate(perk.templateId)!
      expect(template).toBeDefined()
      expect(perk.magnitude).toBeGreaterThanOrEqual(template.minMagnitude)
      expect(perk.magnitude).toBeLessThanOrEqual(template.maxMagnitude)
    }
  })

  it('can roll every template in the pool (not stuck on a subset)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(rollRandomPerk().templateId)
    expect(seen.size).toBe(PASSIVE_PERK_POOL.length)
  })
})

describe('grantedPerkLabel', () => {
  it('formats a real perk with its name, percentage, and stat', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // first pool entry, minimum magnitude
    const perk = rollRandomPerk()
    vi.restoreAllMocks()
    expect(grantedPerkLabel(perk)).toBe(`${passivePerkTemplate(perk.templateId)!.displayName} +${Math.round(perk.magnitude * 1000) / 10}% Fleet DPS`)
  })

  it('falls back gracefully for an unknown templateId (pool changed since it was granted)', () => {
    expect(grantedPerkLabel({ templateId: 'not-a-real-id', magnitude: 0.05 })).toBe('Unknown Perk +5%')
  })
})
