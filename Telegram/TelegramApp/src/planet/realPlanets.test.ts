import { describe, expect, it } from 'vitest'
import { BOSS_PLANETS, REGULAR_PLANETS, realPlanetByName, realPlanetForStage } from './realPlanets'
import { GENERATED_REGULAR, GENERATED_BOSSES } from './rosterGen'

const BOSS_INTERVAL = 10

describe('realPlanetByName', () => {
  // Regression: byName used to only index the 66 hand-tuned objects, so ~99% of the card
  // catalog (every generated object) resolved to undefined - CardArt rendered blank and
  // ObjectViewer's whole body silently didn't mount (its guard is `card && target`).
  it('resolves generated objects, not just the hand-tuned 66', () => {
    expect(realPlanetByName(GENERATED_REGULAR[0].name)).toBe(GENERATED_REGULAR[0])
    expect(realPlanetByName(GENERATED_BOSSES[0].name)).toBe(GENERATED_BOSSES[0])
  })

  it('still resolves hand-tuned objects', () => {
    expect(realPlanetByName('EARTH')?.name).toBe('EARTH')
  })

  it('returns undefined for an unknown name', () => {
    expect(realPlanetByName('NOT A REAL PLANET')).toBeUndefined()
  })
})

describe('realPlanetForStage', () => {
  it('is deterministic: the same sector always shows the same body', () => {
    for (const stage of [1, 7, 10, 33, 999]) {
      expect(realPlanetForStage(stage, BOSS_INTERVAL)).toBe(realPlanetForStage(stage, BOSS_INTERVAL))
    }
  })

  it('starts the journey at Mercury and reaches Earth by sector 3', () => {
    expect(realPlanetForStage(1, BOSS_INTERVAL).name).toBe('MERCURY')
    expect(realPlanetForStage(3, BOSS_INTERVAL).name).toBe('EARTH')
  })

  it('boss sectors escalate: giants, then stars, then nebulae, galaxies, black holes', () => {
    expect(realPlanetForStage(10, BOSS_INTERVAL).name).toBe('JUPITER')
    expect(realPlanetForStage(20, BOSS_INTERVAL).name).toBe('SATURN')
    expect(realPlanetForStage(110, BOSS_INTERVAL).name).toBe('THE SUN') // boss #11: first star
    expect(realPlanetForStage(210, BOSS_INTERVAL).name).toBe('ORION NEBULA') // boss #21: first nebula
    expect(realPlanetForStage(210, BOSS_INTERVAL).profile.kind).toBe('nebula')
    expect(realPlanetForStage(290, BOSS_INTERVAL).name).toBe('SAGITTARIUS A*')
    expect(realPlanetForStage(300, BOSS_INTERVAL).name).toBe('M87*')
    for (let boss = 1; boss <= 60; boss++) {
      const kind = realPlanetForStage(boss * BOSS_INTERVAL, BOSS_INTERVAL).profile.kind
      expect(['gasGiant', 'nebula']).toContain(kind)
    }
  })

  it('black holes and galaxies carry their disk on the ring quad with their own palette', () => {
    const m87 = realPlanetForStage(300, BOSS_INTERVAL).profile
    expect(m87.kind).toBe('gasGiant')
    if (m87.kind === 'gasGiant') {
      expect(m87.ring).toBe(true)
      expect(m87.ringColors).toBeDefined()
      expect(m87.ringColors![0][0]).toBeGreaterThan(m87.lightColors[0][0]) // disk glows brighter than the shadow body
    }
  })

  it('cycles every boss body before repeating', () => {
    const names = Array.from({ length: BOSS_PLANETS.length }, (_, i) => realPlanetForStage((i + 1) * BOSS_INTERVAL, BOSS_INTERVAL).name)
    expect(new Set(names).size).toBe(BOSS_PLANETS.length)
  })

  it('walks the regular roster in order with no entry skipped across boss gaps', () => {
    const seen: string[] = []
    for (let stage = 1; seen.length < REGULAR_PLANETS.length; stage++) {
      if (stage % BOSS_INTERVAL === 0) continue
      seen.push(realPlanetForStage(stage, BOSS_INTERVAL).name)
    }
    expect(seen).toEqual(REGULAR_PLANETS.map((p) => p.name))
  })

  it('has unique names within each roster', () => {
    expect(new Set(REGULAR_PLANETS.map((p) => p.name)).size).toBe(REGULAR_PLANETS.length)
    expect(new Set(BOSS_PLANETS.map((p) => p.name)).size).toBe(BOSS_PLANETS.length)
  })

  it('among the planets, only true ringed giants carry a ring', () => {
    const planetBosses = BOSS_PLANETS.slice(0, 10)
    const ringed = planetBosses.filter((p) => p.profile.kind === 'gasGiant' && p.profile.ring).map((p) => p.name)
    expect(ringed).toEqual(['SATURN', 'J1407 B'])
  })

  it('clamps nonsense stages instead of crashing', () => {
    expect(realPlanetForStage(0, BOSS_INTERVAL).name).toBe('MERCURY')
    expect(realPlanetForStage(-5, BOSS_INTERVAL).name).toBe('MERCURY')
    expect(realPlanetForStage(3.7, BOSS_INTERVAL).name).toBe('EARTH')
  })
})
