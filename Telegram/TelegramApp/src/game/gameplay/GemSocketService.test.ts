import { describe, expect, it } from 'vitest'
import { GemSocketService } from './GemSocketService'

describe('GemSocketService', () => {
  it('starts empty: every multiplier is 1, every crit chance is 0', () => {
    const g = new GemSocketService()
    expect(g.dpsMultiplier().toNumber()).toBeCloseTo(1, 6)
    expect(g.offlineRewardMultiplier().toNumber()).toBeCloseTo(1, 6)
    expect(g.tapCritChance()).toBe(0)
    expect(g.cardAt('assault-gem-1')).toBeUndefined()
  })

  it('setSocket assigns a card and its bespoke ability moves the matching multiplier', () => {
    const g = new GemSocketService()
    g.setSocket('assault-gem-1', 'earth', 'standard') // bespoke: OfflineReward +35%
    expect(g.cardAt('assault-gem-1')).toEqual({ cardId: 'earth', variant: 'standard' })
    expect(g.offlineRewardMultiplier().toNumber()).toBeCloseTo(1.35, 6)
    expect(g.dpsMultiplier().toNumber()).toBeCloseTo(1, 6) // unaffected - wrong effect
  })

  it('socketing the same card into a new node moves it (one card, one socket)', () => {
    const g = new GemSocketService()
    g.setSocket('assault-gem-1', 'earth', 'standard')
    g.setSocket('armada-gem-1', 'earth', 'standard')
    expect(g.cardAt('assault-gem-1')).toBeUndefined()
    expect(g.cardAt('armada-gem-1')).toEqual({ cardId: 'earth', variant: 'standard' })
  })

  it('clearSocket empties a node without touching others', () => {
    const g = new GemSocketService()
    g.setSocket('assault-gem-1', 'earth', 'standard')
    g.setSocket('armada-gem-1', 'jupiter', 'standard') // bespoke: Dps +20%
    g.clearSocket('assault-gem-1')
    expect(g.cardAt('assault-gem-1')).toBeUndefined()
    expect(g.cardAt('armada-gem-1')).toBeDefined()
    expect(g.offlineRewardMultiplier().toNumber()).toBeCloseTo(1, 6)
    expect(g.dpsMultiplier().toNumber()).toBeCloseTo(1.2, 6)
  })

  it('hydrate replaces all assignments from a server payload, dropping malformed entries', () => {
    const g = new GemSocketService()
    g.setSocket('assault-gem-1', 'earth', 'standard')
    g.hydrate([
      { nodeId: 'armada-gem-1', cardId: 'jupiter', variant: 'foil' },
      // @ts-expect-error deliberately malformed to prove it's dropped, not thrown
      { nodeId: 'bad', cardId: null, variant: 'standard' },
    ])
    expect(g.cardAt('assault-gem-1')).toBeUndefined() // hydrate replaces, doesn't merge
    expect(g.cardAt('armada-gem-1')).toEqual({ cardId: 'jupiter', variant: 'foil' })
    expect(g.cardAt('bad')).toBeUndefined()
  })

  it('serialize round-trips through hydrate', () => {
    const g = new GemSocketService()
    g.setSocket('assault-gem-1', 'earth', 'standard')
    g.setSocket('armada-gem-1', 'jupiter', 'foil')
    const g2 = new GemSocketService()
    g2.hydrate(g.serialize())
    expect(g2.serialize().sort((a, b) => a.nodeId.localeCompare(b.nodeId))).toEqual(g.serialize().sort((a, b) => a.nodeId.localeCompare(b.nodeId)))
  })

  it('crit-chance buckets sum across sockets and cap below 1', () => {
    const g = new GemSocketService()
    // psr-b1919-21 (bespoke Pulsar -> TapCritChance +5%), orion-nebula (bespoke Nebula -> ShipCritChance +5%)
    g.setSocket('precision-gem-1', 'psr-b1919-21', 'standard')
    g.setSocket('precision-gem-2', 'orion-nebula', 'standard')
    expect(g.tapCritChance()).toBeCloseTo(0.05, 6)
    expect(g.shipCritChance()).toBeCloseTo(0.05, 6)
    expect(g.tapCritChance()).toBeLessThan(1)
  })

  it('xpGainMultiplier only reflects Wanderer-bucket (XpGain) cards', () => {
    const g = new GemSocketService()
    expect(g.xpGainMultiplier()).toBeCloseTo(1, 6)
    g.setSocket('ascendant-gem-1', 'halleys-comet', 'standard') // bespoke: XpGain +16%
    expect(g.xpGainMultiplier()).toBeCloseTo(1.16, 6)
  })

  it('an unrecognized cardId contributes nothing rather than throwing', () => {
    const g = new GemSocketService()
    g.setSocket('assault-gem-1', 'not-a-real-card', 'standard')
    expect(g.dpsMultiplier().toNumber()).toBeCloseTo(1, 6)
    expect(g.tapCritChance()).toBe(0)
  })

  it('hydrate with owned duplicates boosts the socketed card - the real player report: 14 copies (level 4)', () => {
    const g = new GemSocketService()
    const fourteenEarths = Array.from({ length: 14 }, (_, i) => ({ instanceId: i, cardId: 'earth', variant: 'standard' as const, serial: i, mintedAtMs: 0 }))
    g.hydrate([{ nodeId: 'armada-gem-1', cardId: 'earth', variant: 'standard' }], fourteenEarths)
    expect(g.levelOf('earth')).toBe(4) // 1 + floor(log2(14))
    // Base Earth ability is OfflineReward +35%; level 4 = +15%*3 = +45% of that base magnitude.
    expect(g.offlineRewardMultiplier().toNumber()).toBeCloseTo(1 + 0.35 * 1.45, 6)
  })

  it('a single owned copy (level 1) is unaffected - no boost until you own duplicates', () => {
    const g = new GemSocketService()
    g.hydrate([{ nodeId: 'armada-gem-1', cardId: 'earth', variant: 'standard' }], [{ instanceId: 1, cardId: 'earth', variant: 'standard', serial: 1, mintedAtMs: 0 }])
    expect(g.levelOf('earth')).toBe(1)
    expect(g.offlineRewardMultiplier().toNumber()).toBeCloseTo(1.35, 6)
  })
})
