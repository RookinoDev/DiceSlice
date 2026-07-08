// Shared builders that turn a name + palette into a full PlanetProfile. Extracted from
// realPlanets.ts so both the hand-tuned roster (realPlanets.ts) and the database-generated
// roster (rosterGen.ts) construct profiles through the exact same code path.
import type { PlanetProfile } from './planetProfiles'
import type { RGB } from './themes'

export interface RealPlanet {
  name: string
  profile: PlanetProfile
}

// One shared light direction (upper-left key light) so the roster reads as a coherent set.
export const LIGHT: [number, number] = [0.36, 0.31]

export function noAtmo(name: string, seed: number, ground: [RGB, RGB, RGB], craters: [RGB, RGB], terrainSize = 50, craterSize = 8): RealPlanet {
  return {
    name,
    profile: { kind: 'noAtmosphere', seed, lightOrigin: LIGHT, rotationRate: 0.025, groundColors: ground, craterColors: craters, terrainSize, craterSize, craterTimeSpeed: 0.05 },
  }
}

export interface TerranOpts {
  landCutoff?: number
  cloudCover?: number
  terrainSize?: number
}

export function terran(name: string, seed: number, water: [RGB, RGB, RGB], land: [RGB, RGB, RGB, RGB], clouds: [RGB, RGB, RGB, RGB], opts: TerranOpts = {}): RealPlanet {
  return {
    name,
    profile: {
      kind: 'terranWet',
      seed,
      lightOrigin: LIGHT,
      rotationRate: 0.06,
      waterColors: water,
      landColors: land,
      cloudColors: clouds,
      terrainSize: opts.terrainSize ?? 50,
      cloudSize: 40,
      landCutoff: opts.landCutoff ?? 0.5,
      cloudCover: opts.cloudCover ?? 1.2,
      cloudStretch: 2.0,
      cloudSpeed: 0.12,
      cloudCurve: 1.4,
    },
  }
}

export interface GasOpts {
  bands?: number
  ring?: boolean
  gasTimeSpeed?: number
  ringColors?: [RGB, RGB, RGB]
  ringDarkColors?: [RGB, RGB, RGB]
}

export function gas(name: string, seed: number, light: [RGB, RGB, RGB], dark: [RGB, RGB, RGB], opts: GasOpts = {}): RealPlanet {
  return {
    name,
    profile: {
      kind: 'gasGiant',
      seed,
      lightOrigin: LIGHT,
      rotationRate: 0.18,
      lightColors: light,
      darkColors: dark,
      gasSize: 55,
      cloudCover: 0.4,
      bands: opts.bands ?? 1.6,
      stretch: 2.2,
      gasTimeSpeed: opts.gasTimeSpeed ?? 0.12,
      ring: opts.ring ?? false,
      ringColors: opts.ringColors,
      ringDarkColors: opts.ringDarkColors,
    },
  }
}

/** A star: roiling plasma via the gas shader - soft banding, fast churn, no surface to crack. */
export function star(name: string, seed: number, light: [RGB, RGB, RGB], dark: [RGB, RGB, RGB], churn = 0.32): RealPlanet {
  return gas(name, seed, light, dark, { bands: 0.7, gasTimeSpeed: churn })
}

/** A black hole: near-black body wrapped in a glowing accretion disk (the ring, in disk colors). */
export function blackHole(name: string, seed: number, disk: [RGB, RGB, RGB], diskDark: [RGB, RGB, RGB]): RealPlanet {
  return gas(
    name,
    seed,
    [[0.07, 0.05, 0.04], [0.04, 0.03, 0.02], [0.02, 0.01, 0.01]],
    [[0.03, 0.02, 0.01], [0.015, 0.01, 0.005], [0.005, 0.003, 0.002]],
    { bands: 0.3, gasTimeSpeed: 0.4, ring: true, ringColors: disk, ringDarkColors: diskDark },
  )
}

/** A galaxy: bright warm core with the ring as its disk of spiral arms. */
export function galaxy(name: string, seed: number, core: [RGB, RGB, RGB], arms: [RGB, RGB, RGB], armsDark: [RGB, RGB, RGB]): RealPlanet {
  return gas(
    name,
    seed,
    core,
    [[core[2][0] * 0.6, core[2][1] * 0.6, core[2][2] * 0.6], [core[2][0] * 0.35, core[2][1] * 0.35, core[2][2] * 0.35], [core[2][0] * 0.15, core[2][1] * 0.15, core[2][2] * 0.15]],
    { bands: 0.3, gasTimeSpeed: 0.06, ring: true, ringColors: arms, ringDarkColors: armsDark },
  )
}

/** A nebula: surfaceless stacked wisps - a dense colored core inside a thin outer shell. */
export function nebula(name: string, seed: number, inner: [RGB, RGB, RGB, RGB], outer: [RGB, RGB, RGB, RGB]): RealPlanet {
  return {
    name,
    profile: { kind: 'nebula', seed, lightOrigin: LIGHT, rotationRate: 0.015, innerColors: inner, outerColors: outer, innerCover: 0.5, outerCover: 0.95, cloudSize: 36 },
  }
}

export function ice(name: string, seed: number, land: [RGB, RGB, RGB], lakes: [RGB, RGB, RGB], clouds: [RGB, RGB, RGB, RGB], cloudCover = 1.55): RealPlanet {
  return {
    name,
    profile: {
      kind: 'iceWorld',
      seed,
      lightOrigin: LIGHT,
      rotationRate: 0.025,
      landColors: land,
      lakeColors: lakes,
      cloudColors: clouds,
      terrainSize: 50,
      cloudSize: 40,
      cloudCover,
      cloudStretch: 2.0,
      cloudSpeed: 0.1,
      cloudCurve: 1.3,
    },
  }
}

export function lava(name: string, seed: number, ground: [RGB, RGB, RGB], craters: [RGB, RGB], lavaColors: [RGB, RGB, RGB], riverCutoff = 0.58): RealPlanet {
  return {
    name,
    profile: {
      kind: 'lavaWorld',
      seed,
      lightOrigin: LIGHT,
      rotationRate: 0.05,
      groundColors: ground,
      craterColors: craters,
      lavaColors: lavaColors,
      terrainSize: 50,
      craterSize: 8,
      craterTimeSpeed: 0.05,
      riverCutoff,
      lavaTimeSpeed: 0.25,
    },
  }
}

export function rock(name: string, seed: number, colors: [RGB, RGB, RGB], size = 50): RealPlanet {
  return { name, profile: { kind: 'asteroid', seed, lightOrigin: LIGHT, rotationRate: 0.12, colors, size } }
}

// Very high cloudCover value = almost no clouds (the shader treats cover as "1.61 - density").
export const NO_CLOUDS = 1.58
// Wisps of white for airless-ish icy bodies.
export const FAINT_WHITE_CLOUDS: [RGB, RGB, RGB, RGB] = [[0.95, 0.96, 0.98], [0.85, 0.87, 0.9], [0.72, 0.75, 0.8], [0.58, 0.62, 0.68]]
