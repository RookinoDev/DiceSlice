import { describe, expect, it } from 'vitest'
import { GENERATED_BOSSES, GENERATED_REGULAR } from './rosterGen'
import { BOSS_PLANETS, REGULAR_PLANETS, realPlanetForStage } from './realPlanets'
import { planetMaxScale } from './planetProfiles'

const BOSS_INTERVAL = 10

function allColors(profile: Record<string, unknown>): number[] {
  const out: number[] = []
  for (const v of Object.values(profile)) {
    if (Array.isArray(v)) for (const c of v.flat(2)) if (typeof c === 'number') out.push(c)
  }
  return out
}

describe('generated roster', () => {
  it('is big: the databases add hundreds of objects to each roster', () => {
    expect(GENERATED_REGULAR.length).toBeGreaterThan(500)
    expect(GENERATED_BOSSES.length).toBeGreaterThan(200)
  })

  // ~5,800 objects x 4 assertions each - comfortably under 5s on CI, but this many individual
  // expect() calls (each building a custom failure message) can crawl past the default 5000ms
  // timeout on a loaded dev machine. A generous fixed timeout, not a perf fix: the assertions
  // themselves are cheap: only expect()'s own per-call bookkeeping is what adds up here.
  it(
    'every entry maps to a known shader kind with a sane seed and 0..1 colors',
    () => {
      const kinds = new Set(['noAtmosphere', 'terranWet', 'gasGiant', 'nebula', 'iceWorld', 'lavaWorld', 'asteroid'])
      for (const p of [...GENERATED_REGULAR, ...GENERATED_BOSSES]) {
        expect(kinds.has(p.profile.kind), `${p.name}: kind ${p.profile.kind}`).toBe(true)
        expect(p.profile.seed).toBeGreaterThanOrEqual(1)
        expect(p.profile.seed).toBeLessThan(10)
        for (const c of allColors(p.profile as unknown as Record<string, unknown>)) {
          expect(c, `${p.name}: color component out of range`).toBeGreaterThanOrEqual(0)
          expect(c, `${p.name}: color component out of range`).toBeLessThanOrEqual(1)
        }
        expect(Number.isFinite(planetMaxScale(p.profile)), `${p.name}: planetMaxScale`).toBe(true)
      }
    },
    20000,
  )

  it('never collides with a hand-tuned name', () => {
    const hand = new Set([...REGULAR_PLANETS, ...BOSS_PLANETS].map((p) => p.name))
    for (const p of [...GENERATED_REGULAR, ...GENERATED_BOSSES]) {
      expect(hand.has(p.name), `${p.name} duplicates a hand-tuned object`).toBe(false)
    }
  })

  it('has unique names within the generated rosters', () => {
    const names = [...GENERATED_REGULAR, ...GENERATED_BOSSES].map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('extends the sector journey: past the hand-tuned roster, sectors show generated objects', () => {
    // Regular sector just past the 36 hand-tuned ones (skipping bosses).
    const firstGenerated = realPlanetForStage(REGULAR_PLANETS.length + Math.floor(REGULAR_PLANETS.length / (BOSS_INTERVAL - 1)) + 2, BOSS_INTERVAL)
    expect(GENERATED_REGULAR.some((p) => p.name === firstGenerated.name)).toBe(true)
    // Boss #31 is the first generated boss - a giant exoplanet, continuing the escalation.
    const boss31 = realPlanetForStage(31 * BOSS_INTERVAL, BOSS_INTERVAL)
    expect(boss31.name).toBe(GENERATED_BOSSES[0].name)
    expect(boss31.profile.kind).toBe('gasGiant')
  })

  it('is deterministic across calls at deep sectors', () => {
    for (const stage of [500, 2000, 12345]) {
      expect(realPlanetForStage(stage, BOSS_INTERVAL)).toBe(realPlanetForStage(stage, BOSS_INTERVAL))
    }
  })

  it('boss escalation bands: generated giants come before generated stars', () => {
    const kindsInOrder = GENERATED_BOSSES.map((p) => p.profile.kind)
    const firstNebula = kindsInOrder.indexOf('nebula')
    expect(firstNebula).toBeGreaterThan(0)
    // Everything after the deep-sky band starts is nebula or gas-shader (star/galaxy) - no rocks.
    for (const p of GENERATED_BOSSES) expect(['gasGiant', 'nebula']).toContain(p.profile.kind)
  })
})
