// Turns the database-fetched entries in generatedRoster.json (see scripts/genRoster.mjs -
// NASA Exoplanet Archive, JPL SBDB, SIMBAD) into fully-specified PlanetProfiles, extending
// the hand-tuned roster in realPlanets.ts to ~1100 more real objects.
//
// Everything is deterministic: palettes derive from the object's real physical data
// (equilibrium temperature, radius, spectral type) plus a hash of its name for variety
// within a family. No Math.random - the same object always renders identically.
import generatedRoster from './generatedRoster.json'
import type { RGB } from './themes'
import { gas, ice, lava, nebula, noAtmo, rock, star, terran, galaxy, type RealPlanet } from './profileBuilders'

interface GeneratedEntry {
  n: string
  c: 'exoplanet' | 'asteroid' | 'comet' | 'star' | 'nebula' | 'galaxy'
  /** exoplanet radius, Earth radii */
  r?: number | null
  /** exoplanet equilibrium temperature, K */
  t?: number | null
  /** system distance, parsecs */
  d?: number | null
  /** discovery year */
  y?: number | null
  /** small-body diameter, km */
  D?: number | null
  /** star spectral type, e.g. "K2III" */
  s?: string
  /** star V magnitude */
  v?: number | null
}

// ---------- deterministic pseudo-randomness from the object's name ----------

function nameHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic 0..1 stream: same name + salt always yields the same value. */
function rnd(name: string, salt: number): number {
  let h = nameHash(name) ^ Math.imul(salt + 1, 2654435761)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Shader seed in the same 1..10 range the hand-tuned roster uses. */
function seedFor(name: string): number {
  return 1 + (nameHash(name) % 900) / 100
}

// ---------- palette math ----------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const shade = (c: RGB, f: number): RGB => [clamp01(c[0] * f), clamp01(c[1] * f), clamp01(c[2] * f)]
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Small per-object channel jitter so family members don't look identical. */
function jitter(name: string, c: RGB, amount = 0.08): RGB {
  return [clamp01(c[0] + (rnd(name, 11) - 0.5) * amount), clamp01(c[1] + (rnd(name, 12) - 0.5) * amount), clamp01(c[2] + (rnd(name, 13) - 0.5) * amount)]
}

/** Light-to-dark 3 ramp from a base tone (matches the hand-tuned rosters' shading style). */
function ramp3(base: RGB): [RGB, RGB, RGB] {
  return [base, shade(base, 0.72), shade(base, 0.45)]
}

function ramp4(base: RGB): [RGB, RGB, RGB, RGB] {
  return [base, shade(base, 0.8), shade(base, 0.62), shade(base, 0.45)]
}

// ---------- per-class profile mapping ----------

/** Rocky-world family by real equilibrium temperature (K). */
function mapRockyExoplanet(e: GeneratedEntry): RealPlanet {
  const name = e.n
  const seed = seedFor(name)
  // Unknown temperature: most no-teq entries are far/cold - bias that way, deterministically.
  const t = e.t ?? (rnd(name, 1) < 0.55 ? 120 : 400)

  if (t < 160) {
    // Frozen world: white ice tinted cold, darker frozen "lakes".
    const tint: RGB = mix([0.93, 0.94, 0.97], [0.78, 0.86, 0.95], rnd(name, 2))
    const lakes: RGB = jitter(name, mix([0.45, 0.55, 0.72], [0.55, 0.42, 0.38], rnd(name, 3)))
    return ice(name, seed, ramp3(jitter(name, tint, 0.05)), ramp3(lakes), ramp4([0.95, 0.96, 0.98]), 1.58)
  }
  if (t < 330) {
    // Temperate: liquid water plausible. Land hue spans rust (red-dwarf light) to green.
    const water: RGB = jitter(name, mix([0.06, 0.14, 0.42], [0.05, 0.24, 0.3], rnd(name, 4)))
    const land: RGB = jitter(name, mix([0.2, 0.45, 0.16], [0.6, 0.36, 0.14], rnd(name, 5)))
    const clouds: RGB = mix([0.92, 0.93, 0.95], [0.85, 0.74, 0.6], rnd(name, 6))
    return terran(name, seed, ramp3(water), ramp4(land), ramp4(clouds), { landCutoff: 0.4 + rnd(name, 7) * 0.25, cloudCover: 1.0 + rnd(name, 8) * 0.4 })
  }
  if (t < 750) {
    // Hot barren rock: Mercury-to-Mars family, warm grays through rusts.
    const ground: RGB = jitter(name, mix([0.6, 0.55, 0.5], [0.66, 0.34, 0.16], rnd(name, 9)))
    const craterTone = shade(ground, 0.6)
    return noAtmo(name, seed, ramp3(ground), [craterTone, shade(craterTone, 0.5)], 45 + Math.floor(rnd(name, 10) * 15), 6 + Math.floor(rnd(name, 14) * 8))
  }
  // Molten: darker crust the hotter it runs, lava from deep orange to white-hot.
  const heat = clamp01((t - 750) / 1500)
  const crust: RGB = shade([0.2, 0.15, 0.12], 1 - heat * 0.5)
  const lavaBright: RGB = mix([1.0, 0.55, 0.08], [1.0, 0.92, 0.55], heat)
  return lava(name, seed, ramp3(crust), [shade(crust, 0.7), shade(crust, 0.35)], [lavaBright, shade(lavaBright, 0.7), shade(lavaBright, 0.45)], 0.5 + rnd(name, 15) * 0.12)
}

/** Gas-giant family (radius >= ~1.8 Earth radii) by temperature: tan -> blue -> ember. */
function mapGasExoplanet(e: GeneratedEntry): RealPlanet {
  const name = e.n
  const seed = seedFor(name)
  const t = e.t ?? 150
  let base: RGB
  if (t < 250) base = mix([0.88, 0.78, 0.6], [0.7, 0.82, 0.85], rnd(name, 2)) // cold: Jupiter tan to Uranus teal
  else if (t < 900) base = mix([0.35, 0.55, 0.9], [0.45, 0.7, 0.85], rnd(name, 3)) // warm: blue family
  else base = mix([0.5, 0.25, 0.18], [0.6, 0.3, 0.4], rnd(name, 4)) // hot Jupiter: dark ember/violet
  const light = ramp3(jitter(name, base))
  const dark: [RGB, RGB, RGB] = [shade(base, 0.42), shade(base, 0.26), shade(base, 0.13)]
  return gas(name, seed, light, dark, {
    bands: 0.6 + rnd(name, 5) * 2.0,
    gasTimeSpeed: 0.05 + rnd(name, 6) * 0.18 + (t > 900 ? 0.08 : 0),
    ring: rnd(name, 7) < 0.08, // rings around exoplanets are (so far) vanishingly rare finds
  })
}

function mapAsteroid(e: GeneratedEntry): RealPlanet {
  const name = e.n
  const families: RGB[] = [
    [0.5, 0.48, 0.46], // gray (C-type)
    [0.55, 0.45, 0.32], // brown (S-type)
    [0.58, 0.38, 0.24], // reddish
    [0.5, 0.52, 0.6], // metallic (M-type)
  ]
  const bright = jitter(name, families[nameHash(name) % families.length])
  // Bigger real diameter = visually bigger rock (Ceres-class ~940km maxes the range).
  const size = 40 + Math.min(20, (e.D ?? 200) / 50)
  return rock(name, seedFor(name), [shade(bright, 0.28), shade(bright, 0.62), bright], size)
}

function mapComet(e: GeneratedEntry): RealPlanet {
  const name = e.n
  // Dirty snowball: near-black crust with icy glints (same style as the hand-tuned comets).
  const iceTint: RGB = jitter(name, mix([0.62, 0.66, 0.74], [0.7, 0.66, 0.58], rnd(name, 2)), 0.06)
  return rock(name, seedFor(name), [shade(iceTint, 0.15), shade(iceTint, 0.42), iceTint], 36 + rnd(name, 3) * 8)
}

/** Star color from the real spectral class letter (O hottest/blue -> M coolest/red). */
const SPECTRAL_TONES: Record<string, RGB> = {
  O: [0.7, 0.82, 1.0],
  B: [0.78, 0.87, 1.0],
  A: [0.92, 0.95, 1.0],
  F: [0.98, 0.97, 0.92],
  G: [1.0, 0.94, 0.7],
  K: [1.0, 0.78, 0.5],
  M: [1.0, 0.58, 0.32],
  C: [0.95, 0.42, 0.22], // carbon star: deep red
  S: [1.0, 0.6, 0.3],
}

function mapStar(e: GeneratedEntry): RealPlanet {
  const name = e.n
  const letter = (e.s ?? '').match(/[OBAFGKMCS]/)?.[0] ?? 'A'
  const base = jitter(name, SPECTRAL_TONES[letter] ?? SPECTRAL_TONES.A, 0.05)
  const light: [RGB, RGB, RGB] = [base, shade(base, 0.8), shade(base, 0.58)]
  const dark: [RGB, RGB, RGB] = [shade(base, 0.42), shade(base, 0.26), shade(base, 0.14)]
  // Luminosity class I/II = super/bright giants: vast, slow-churning surfaces.
  const isGiant = /I(?!I?I)|II\b/.test(e.s ?? '')
  return star(name, seedFor(name), light, dark, isGiant ? 0.26 : 0.34 + rnd(name, 2) * 0.08)
}

const NEBULA_FAMILIES: [RGB, RGB][] = [
  [[0.95, 0.45, 0.65], [0.35, 0.65, 0.72]], // pink core / cyan shell (Orion-style)
  [[0.95, 0.55, 0.3], [0.55, 0.7, 0.85]], // orange / blue (Crab-style)
  [[0.45, 0.85, 0.85], [0.9, 0.45, 0.3]], // teal / orange (Helix-style)
  [[0.7, 0.45, 0.9], [0.9, 0.75, 0.4]], // violet / gold
  [[0.45, 0.85, 0.55], [0.9, 0.5, 0.7]], // green / pink
]

function mapNebula(e: GeneratedEntry): RealPlanet {
  const name = e.n
  const [inner, outer] = NEBULA_FAMILIES[nameHash(name) % NEBULA_FAMILIES.length]
  return nebula(name, seedFor(name), ramp4(jitter(name, inner)), ramp4(jitter(name, outer)))
}

function mapGalaxy(e: GeneratedEntry): RealPlanet {
  const name = e.n
  const core: RGB = jitter(name, mix([1.0, 0.94, 0.8], [0.98, 0.88, 0.68], rnd(name, 2)), 0.04)
  const arms: RGB = jitter(name, rnd(name, 3) < 0.7 ? [0.65, 0.76, 0.95] : [0.6, 0.5, 0.4]) // blue spiral or dusty lenticular
  return galaxy(name, seedFor(name), ramp3(core), ramp3(arms), [shade(arms, 0.3), shade(arms, 0.18), shade(arms, 0.09)])
}

// ---------- roster assembly ----------

function mapEntry(e: GeneratedEntry): RealPlanet {
  switch (e.c) {
    case 'exoplanet':
      return (e.r ?? 1) >= 1.8 ? mapGasExoplanet(e) : mapRockyExoplanet(e)
    case 'asteroid':
      return mapAsteroid(e)
    case 'comet':
      return mapComet(e)
    case 'star':
      return mapStar(e)
    case 'nebula':
      return mapNebula(e)
    case 'galaxy':
      return mapGalaxy(e)
  }
}

const entries = generatedRoster.entries as GeneratedEntry[]

/**
 * Regular-sector extension: rocky and Neptune-class exoplanets, asteroids, comets -
 * hash-shuffled (deterministically) so classes stay interleaved instead of arriving in
 * database order, but giants (radius >= 6 Re) are promoted to the boss roster.
 */
export const GENERATED_REGULAR: RealPlanet[] = entries
  .filter((e) => (e.c === 'exoplanet' && (e.r ?? 1) < 6) || e.c === 'asteroid' || e.c === 'comet')
  .sort((a, b) => nameHash(a.n) - nameHash(b.n))
  .map(mapEntry)

/**
 * Boss-sector extension, continuing the hand-tuned escalation bands: giant exoplanets,
 * then real stars (brightest first), then named nebulae and galaxies.
 */
export const GENERATED_BOSSES: RealPlanet[] = [
  ...entries.filter((e) => e.c === 'exoplanet' && (e.r ?? 1) >= 6).sort((a, b) => nameHash(a.n) - nameHash(b.n)),
  ...entries.filter((e) => e.c === 'star'),
  ...entries.filter((e) => e.c === 'nebula' || e.c === 'galaxy').sort((a, b) => nameHash(a.n) - nameHash(b.n)),
].map(mapEntry)
