import { describe, expect, it } from 'vitest'
import { BOSS_PLANETS, REGULAR_PLANETS, realPlanetForStage } from './realPlanets'

const BOSS_INTERVAL = 10

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

  it('boss sectors always serve giants, starting with Jupiter then Saturn', () => {
    expect(realPlanetForStage(10, BOSS_INTERVAL).name).toBe('JUPITER')
    expect(realPlanetForStage(20, BOSS_INTERVAL).name).toBe('SATURN')
    for (let boss = 1; boss <= 30; boss++) {
      expect(realPlanetForStage(boss * BOSS_INTERVAL, BOSS_INTERVAL).profile.kind).toBe('gasGiant')
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

  it('only true ringed giants carry a ring', () => {
    const ringed = BOSS_PLANETS.filter((p) => p.profile.kind === 'gasGiant' && p.profile.ring).map((p) => p.name)
    expect(ringed).toEqual(['SATURN', 'J1407 B'])
  })

  it('clamps nonsense stages instead of crashing', () => {
    expect(realPlanetForStage(0, BOSS_INTERVAL).name).toBe('MERCURY')
    expect(realPlanetForStage(-5, BOSS_INTERVAL).name).toBe('MERCURY')
    expect(realPlanetForStage(3.7, BOSS_INTERVAL).name).toBe('EARTH')
  })
})
