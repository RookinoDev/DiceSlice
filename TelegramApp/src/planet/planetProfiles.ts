// Ported from the Spawn*/SetRandomCloudStyle randomization logic in
// Assets/PixelPlanets/Scripts/PixelPlanetGenerator.cs. All 6 base planet types are ported;
// the rarity/legendary system (extra effect layers, optional rings on non-gas planets) is not.
import { themesAsteroid, themesGas, themesIce, themesLava, themesNoAtmo, themesTerran, type RGB } from './themes'

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomLightOrigin(): [number, number] {
  const angle = randRange(0, Math.PI * 2)
  const dist = randRange(0.18, 0.34)
  return [0.5 + Math.cos(angle) * dist, 0.5 + Math.sin(angle) * dist]
}

function randomSeed(): number {
  return randRange(0.01, 10)
}

/** Ported from PixelPlanetGenerator.SetRandomCloudStyle. */
function randomCloudStyle() {
  const density = Math.random() < 0.1 ? randRange(0.5, 1.6) : randRange(0.01, 0.5)
  return {
    cover: 1.61 - density,
    stretch: randRange(1.0, 3.0),
    speed: randRange(0.06, 0.35),
    curve: randRange(1.0, 1.9),
  }
}

export interface NoAtmosphereProfile {
  kind: 'noAtmosphere'
  seed: number
  lightOrigin: [number, number]
  rotationRate: number
  groundColors: RGB[]
  craterColors: RGB[]
  terrainSize: number
  craterSize: number
  craterTimeSpeed: number
}

export interface TerranWetProfile {
  kind: 'terranWet'
  seed: number
  lightOrigin: [number, number]
  rotationRate: number
  waterColors: RGB[]
  landColors: RGB[]
  cloudColors: RGB[]
  terrainSize: number
  cloudSize: number
  landCutoff: number
  cloudCover: number
  cloudStretch: number
  cloudSpeed: number
  cloudCurve: number
}

export interface GasGiantProfile {
  kind: 'gasGiant'
  seed: number
  lightOrigin: [number, number]
  rotationRate: number
  lightColors: RGB[]
  darkColors: RGB[]
  gasSize: number
  cloudCover: number
  bands: number
  stretch: number
  gasTimeSpeed: number
}

export interface IceWorldProfile {
  kind: 'iceWorld'
  seed: number
  lightOrigin: [number, number]
  rotationRate: number
  landColors: RGB[]
  lakeColors: RGB[]
  cloudColors: RGB[]
  terrainSize: number
  cloudSize: number
  cloudCover: number
  cloudStretch: number
  cloudSpeed: number
  cloudCurve: number
}

export interface LavaWorldProfile {
  kind: 'lavaWorld'
  seed: number
  lightOrigin: [number, number]
  rotationRate: number
  groundColors: RGB[]
  craterColors: RGB[]
  lavaColors: RGB[]
  terrainSize: number
  craterSize: number
  craterTimeSpeed: number
  riverCutoff: number
  lavaTimeSpeed: number
}

export interface AsteroidProfile {
  kind: 'asteroid'
  seed: number
  lightOrigin: [number, number]
  rotationRate: number
  colors: RGB[]
  size: number
}

export type PlanetProfile = NoAtmosphereProfile | TerranWetProfile | GasGiantProfile | IceWorldProfile | LavaWorldProfile | AsteroidProfile

export function createNoAtmosphereProfile(): NoAtmosphereProfile {
  const theme = pickRandom(themesNoAtmo)
  return {
    kind: 'noAtmosphere',
    seed: randomSeed(),
    lightOrigin: randomLightOrigin(),
    rotationRate: 0.025,
    groundColors: theme.slice(0, 3),
    craterColors: theme.slice(3, 5),
    terrainSize: randRange(28, 78),
    craterSize: randRange(2, 20),
    craterTimeSpeed: Math.random() < 0.1 ? randRange(0.2, 0.6) : randRange(0, 0.2),
  }
}

export function createTerranWetProfile(): TerranWetProfile {
  const theme = pickRandom(themesTerran)
  const cloud = randomCloudStyle()
  return {
    kind: 'terranWet',
    seed: randomSeed(),
    lightOrigin: randomLightOrigin(),
    rotationRate: 0.06,
    waterColors: theme.slice(0, 3),
    landColors: theme.slice(3, 7),
    cloudColors: theme.slice(7, 11),
    terrainSize: randRange(28, 78),
    cloudSize: randRange(22, 70),
    landCutoff: randRange(0.2, 0.7),
    cloudCover: cloud.cover,
    cloudStretch: cloud.stretch,
    cloudSpeed: cloud.speed,
    cloudCurve: cloud.curve,
  }
}

export function createGasGiantProfile(): GasGiantProfile {
  const theme = pickRandom(themesGas)
  return {
    kind: 'gasGiant',
    seed: randomSeed(),
    lightOrigin: randomLightOrigin(),
    rotationRate: 0.18,
    lightColors: theme.slice(0, 3),
    darkColors: theme.slice(3, 6),
    gasSize: randRange(35, 72),
    cloudCover: randRange(0.28, 0.5),
    bands: randRange(0.4, 2.5),
    stretch: randRange(1.2, 3.0),
    gasTimeSpeed: randRange(0.04, 0.28),
  }
}

export function createIceWorldProfile(): IceWorldProfile {
  const theme = pickRandom(themesIce)
  const cloud = randomCloudStyle()
  return {
    kind: 'iceWorld',
    seed: randomSeed(),
    lightOrigin: randomLightOrigin(),
    rotationRate: 0.025,
    landColors: theme.slice(0, 3),
    lakeColors: theme.slice(3, 6),
    cloudColors: theme.slice(6, 10),
    terrainSize: randRange(28, 78),
    cloudSize: randRange(22, 70),
    cloudCover: cloud.cover,
    cloudStretch: cloud.stretch,
    cloudSpeed: cloud.speed,
    cloudCurve: cloud.curve,
  }
}

export function createLavaWorldProfile(): LavaWorldProfile {
  const theme = pickRandom(themesLava)
  return {
    kind: 'lavaWorld',
    seed: randomSeed(),
    lightOrigin: randomLightOrigin(),
    rotationRate: 0.05,
    groundColors: theme.slice(0, 3),
    craterColors: theme.slice(3, 5),
    lavaColors: theme.slice(5, 8),
    terrainSize: randRange(28, 78),
    craterSize: randRange(2, 20),
    craterTimeSpeed: Math.random() < 0.1 ? randRange(0.2, 0.6) : randRange(0, 0.2),
    riverCutoff: Math.random() < 0.1 ? randRange(0.42, 0.54) : randRange(0.54, 0.66),
    lavaTimeSpeed: randRange(0.15, 0.4),
  }
}

export function createAsteroidProfile(): AsteroidProfile {
  return {
    kind: 'asteroid',
    seed: randomSeed(),
    lightOrigin: randomLightOrigin(),
    rotationRate: 0.12,
    colors: pickRandom(themesAsteroid),
    size: randRange(30, 72),
  }
}

const PROFILE_FACTORIES = [
  createNoAtmosphereProfile,
  createTerranWetProfile,
  createGasGiantProfile,
  createIceWorldProfile,
  createLavaWorldProfile,
  createAsteroidProfile,
]

export function createRandomPlanetProfile(): PlanetProfile {
  return pickRandom(PROFILE_FACTORIES)()
}

// A gas giant's ring quad is scaled this far past the base 1x sphere quad in PlanetCanvas so
// it can extend beyond the planet, Saturn-style (matches MakeLayer's scaleMultiplier in the
// Unity source). Lives here (not PlanetCanvas.tsx) so CombatScreen can size a box for it
// without statically importing PlanetCanvas's Three.js dependencies (that stays lazy-loaded).
export const RING_SCALE = 3

/** How many multiples of the base 1x sphere size this profile's largest layer needs on screen. */
export function planetMaxScale(profile: PlanetProfile): number {
  return profile.kind === 'gasGiant' ? RING_SCALE : 1
}
