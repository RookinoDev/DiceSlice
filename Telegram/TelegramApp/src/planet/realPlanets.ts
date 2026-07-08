// Real space objects with their actual names and appearances tuned to photographs and
// their scientific characteristics, replacing the old random name/profile generation.
// Regular sectors journey outward from the Sun (Mercury -> moons -> Kuiper belt -> comets
// -> confirmed exoplanets) and cycle; boss sectors escalate through the giants, then real
// stars, then nebulae, galaxies, and finally black holes. Everything is deterministic:
// the same sector always shows the same object with the same look.
import type { PlanetProfile } from './planetProfiles'
import type { RGB } from './themes'

export interface RealPlanet {
  name: string
  profile: PlanetProfile
}

// One shared light direction (upper-left key light) so the roster reads as a coherent set.
const LIGHT: [number, number] = [0.36, 0.31]

function noAtmo(name: string, seed: number, ground: [RGB, RGB, RGB], craters: [RGB, RGB], terrainSize = 50, craterSize = 8): RealPlanet {
  return {
    name,
    profile: { kind: 'noAtmosphere', seed, lightOrigin: LIGHT, rotationRate: 0.025, groundColors: ground, craterColors: craters, terrainSize, craterSize, craterTimeSpeed: 0.05 },
  }
}

interface TerranOpts {
  landCutoff?: number
  cloudCover?: number
  terrainSize?: number
}

function terran(name: string, seed: number, water: [RGB, RGB, RGB], land: [RGB, RGB, RGB, RGB], clouds: [RGB, RGB, RGB, RGB], opts: TerranOpts = {}): RealPlanet {
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

interface GasOpts {
  bands?: number
  ring?: boolean
  gasTimeSpeed?: number
  ringColors?: [RGB, RGB, RGB]
  ringDarkColors?: [RGB, RGB, RGB]
}

function gas(name: string, seed: number, light: [RGB, RGB, RGB], dark: [RGB, RGB, RGB], opts: GasOpts = {}): RealPlanet {
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
function star(name: string, seed: number, light: [RGB, RGB, RGB], dark: [RGB, RGB, RGB], churn = 0.32): RealPlanet {
  return gas(name, seed, light, dark, { bands: 0.7, gasTimeSpeed: churn })
}

/** A black hole: near-black body wrapped in a glowing accretion disk (the ring, in disk colors). */
function blackHole(name: string, seed: number, disk: [RGB, RGB, RGB], diskDark: [RGB, RGB, RGB]): RealPlanet {
  return gas(
    name,
    seed,
    [[0.07, 0.05, 0.04], [0.04, 0.03, 0.02], [0.02, 0.01, 0.01]],
    [[0.03, 0.02, 0.01], [0.015, 0.01, 0.005], [0.005, 0.003, 0.002]],
    { bands: 0.3, gasTimeSpeed: 0.4, ring: true, ringColors: disk, ringDarkColors: diskDark },
  )
}

/** A galaxy: bright warm core with the ring as its disk of spiral arms. */
function galaxy(name: string, seed: number, core: [RGB, RGB, RGB], arms: [RGB, RGB, RGB], armsDark: [RGB, RGB, RGB]): RealPlanet {
  return gas(
    name,
    seed,
    core,
    [[core[2][0] * 0.6, core[2][1] * 0.6, core[2][2] * 0.6], [core[2][0] * 0.35, core[2][1] * 0.35, core[2][2] * 0.35], [core[2][0] * 0.15, core[2][1] * 0.15, core[2][2] * 0.15]],
    { bands: 0.3, gasTimeSpeed: 0.06, ring: true, ringColors: arms, ringDarkColors: armsDark },
  )
}

/** A nebula: surfaceless stacked wisps - a dense colored core inside a thin outer shell. */
function nebula(name: string, seed: number, inner: [RGB, RGB, RGB, RGB], outer: [RGB, RGB, RGB, RGB]): RealPlanet {
  return {
    name,
    profile: { kind: 'nebula', seed, lightOrigin: LIGHT, rotationRate: 0.015, innerColors: inner, outerColors: outer, innerCover: 0.5, outerCover: 0.95, cloudSize: 36 },
  }
}

function ice(name: string, seed: number, land: [RGB, RGB, RGB], lakes: [RGB, RGB, RGB], clouds: [RGB, RGB, RGB, RGB], cloudCover = 1.55): RealPlanet {
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

function lava(name: string, seed: number, ground: [RGB, RGB, RGB], craters: [RGB, RGB], lavaColors: [RGB, RGB, RGB], riverCutoff = 0.58): RealPlanet {
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

function rock(name: string, seed: number, colors: [RGB, RGB, RGB], size = 50): RealPlanet {
  return { name, profile: { kind: 'asteroid', seed, lightOrigin: LIGHT, rotationRate: 0.12, colors, size } }
}

// Very high cloudCover value = almost no clouds (the shader treats cover as "1.61 - density").
const NO_CLOUDS = 1.58
// Wisps of white for airless-ish icy bodies.
const FAINT_WHITE_CLOUDS: [RGB, RGB, RGB, RGB] = [[0.95, 0.96, 0.98], [0.85, 0.87, 0.9], [0.72, 0.75, 0.8], [0.58, 0.62, 0.68]]

/**
 * Regular-sector roster: the journey outward. Rocky inner worlds, the great moons,
 * dwarf planets of the Kuiper belt, then real confirmed exoplanets.
 */
export const REGULAR_PLANETS: RealPlanet[] = [
  // — Inner solar system —
  noAtmo('MERCURY', 3.1, [[0.62, 0.58, 0.54], [0.46, 0.42, 0.39], [0.28, 0.25, 0.23]], [[0.38, 0.35, 0.32], [0.18, 0.16, 0.15]], 55, 14),
  gas('VENUS', 1.7, [[0.93, 0.87, 0.7], [0.85, 0.76, 0.55], [0.72, 0.6, 0.4]], [[0.6, 0.48, 0.3], [0.45, 0.34, 0.2], [0.3, 0.22, 0.12]], { bands: 0.5, gasTimeSpeed: 0.05 }),
  terran('EARTH', 4.2, [[0.05, 0.12, 0.4], [0.08, 0.2, 0.55], [0.03, 0.06, 0.22]], [[0.1, 0.3, 0.1], [0.18, 0.48, 0.16], [0.35, 0.58, 0.22], [0.62, 0.55, 0.28]], [[0.9, 0.92, 0.95], [0.75, 0.78, 0.85], [0.58, 0.63, 0.72], [0.4, 0.44, 0.52]], { landCutoff: 0.6, cloudCover: 1.15 }),
  noAtmo('LUNA', 2.4, [[0.72, 0.72, 0.72], [0.55, 0.55, 0.55], [0.3, 0.3, 0.3]], [[0.48, 0.48, 0.48], [0.22, 0.22, 0.22]], 48, 12),
  noAtmo('MARS', 5.8, [[0.72, 0.36, 0.16], [0.55, 0.25, 0.1], [0.34, 0.13, 0.05]], [[0.45, 0.18, 0.07], [0.24, 0.08, 0.03]], 52, 9),
  rock('PHOBOS', 6.3, [[0.16, 0.14, 0.13], [0.35, 0.31, 0.28], [0.52, 0.47, 0.43]], 42),
  noAtmo('CERES', 7.9, [[0.35, 0.34, 0.32], [0.24, 0.23, 0.22], [0.13, 0.13, 0.12]], [[0.85, 0.84, 0.78], [0.55, 0.54, 0.5]], 45, 7), // bright Occator-style spots
  rock('VESTA', 8.6, [[0.3, 0.26, 0.19], [0.55, 0.48, 0.36], [0.75, 0.68, 0.52]], 48),
  // — Jovian & Saturnian moons —
  lava('IO', 2.9, [[0.82, 0.72, 0.3], [0.65, 0.52, 0.2], [0.42, 0.32, 0.1]], [[0.55, 0.42, 0.15], [0.3, 0.2, 0.06]], [[1.0, 0.62, 0.08], [0.85, 0.38, 0.03], [0.6, 0.18, 0.01]], 0.6),
  ice('EUROPA', 3.7, [[0.92, 0.89, 0.83], [0.8, 0.75, 0.68], [0.65, 0.58, 0.5]], [[0.62, 0.42, 0.3], [0.48, 0.3, 0.2], [0.32, 0.18, 0.12]], FAINT_WHITE_CLOUDS, NO_CLOUDS), // tan lineae over cream ice
  noAtmo('GANYMEDE', 4.8, [[0.55, 0.5, 0.44], [0.4, 0.36, 0.31], [0.24, 0.21, 0.18]], [[0.68, 0.64, 0.58], [0.3, 0.27, 0.23]], 50, 10),
  noAtmo('CALLISTO', 5.2, [[0.36, 0.31, 0.26], [0.25, 0.21, 0.17], [0.14, 0.11, 0.09]], [[0.6, 0.56, 0.5], [0.28, 0.24, 0.2]], 60, 6), // dark, densely speckled
  terran('TITAN', 6.1, [[0.28, 0.18, 0.06], [0.2, 0.12, 0.04], [0.1, 0.06, 0.02]], [[0.55, 0.38, 0.12], [0.68, 0.48, 0.16], [0.78, 0.58, 0.22], [0.85, 0.66, 0.3]], [[0.92, 0.7, 0.35], [0.82, 0.58, 0.25], [0.68, 0.45, 0.18], [0.52, 0.33, 0.12]], { landCutoff: 0.45, cloudCover: 0.85 }), // orange haze, dark methane lakes
  ice('ENCELADUS', 7.4, [[0.96, 0.97, 0.99], [0.86, 0.89, 0.94], [0.72, 0.77, 0.86]], [[0.55, 0.72, 0.88], [0.38, 0.55, 0.75], [0.22, 0.36, 0.58]], FAINT_WHITE_CLOUDS, NO_CLOUDS), // blue tiger stripes on white
  noAtmo('MIMAS', 8.2, [[0.68, 0.67, 0.66], [0.52, 0.51, 0.5], [0.32, 0.31, 0.3]], [[0.44, 0.43, 0.42], [0.2, 0.2, 0.19]], 46, 18), // one giant crater
  // — Kuiper belt & beyond —
  ice('TRITON', 1.3, [[0.88, 0.82, 0.78], [0.76, 0.68, 0.64], [0.6, 0.52, 0.48]], [[0.66, 0.5, 0.44], [0.5, 0.36, 0.3], [0.34, 0.22, 0.18]], FAINT_WHITE_CLOUDS, NO_CLOUDS), // pinkish nitrogen ice
  ice('PLUTO', 2.2, [[0.85, 0.72, 0.58], [0.72, 0.58, 0.44], [0.55, 0.42, 0.3]], [[0.32, 0.18, 0.12], [0.22, 0.11, 0.07], [0.12, 0.05, 0.03]], FAINT_WHITE_CLOUDS, NO_CLOUDS), // tan with dark maculae
  noAtmo('CHARON', 3.4, [[0.58, 0.55, 0.53], [0.44, 0.41, 0.4], [0.27, 0.25, 0.24]], [[0.5, 0.32, 0.24], [0.26, 0.15, 0.1]], 48, 8), // gray, reddish polar stain
  ice('HAUMEA', 4.5, [[0.93, 0.94, 0.96], [0.82, 0.84, 0.88], [0.68, 0.71, 0.78]], [[0.6, 0.65, 0.75], [0.45, 0.5, 0.62], [0.3, 0.34, 0.46]], FAINT_WHITE_CLOUDS, NO_CLOUDS),
  noAtmo('MAKEMAKE', 5.6, [[0.6, 0.42, 0.3], [0.46, 0.3, 0.2], [0.3, 0.18, 0.11]], [[0.4, 0.26, 0.17], [0.2, 0.12, 0.07]], 50, 7),
  ice('ERIS', 6.8, [[0.95, 0.95, 0.97], [0.85, 0.86, 0.9], [0.72, 0.74, 0.8]], [[0.66, 0.7, 0.78], [0.5, 0.55, 0.65], [0.35, 0.4, 0.5]], FAINT_WHITE_CLOUDS, NO_CLOUDS), // one of the most reflective bodies known
  noAtmo('SEDNA', 7.1, [[0.6, 0.26, 0.14], [0.45, 0.17, 0.08], [0.28, 0.09, 0.04]], [[0.4, 0.14, 0.06], [0.2, 0.06, 0.02]], 52, 6), // among the reddest objects in the system
  // — Confirmed exoplanets —
  terran('PROXIMA CENTAURI B', 8.8, [[0.1, 0.14, 0.24], [0.07, 0.1, 0.18], [0.03, 0.05, 0.1]], [[0.42, 0.26, 0.16], [0.55, 0.36, 0.22], [0.66, 0.46, 0.28], [0.74, 0.56, 0.36]], [[0.75, 0.62, 0.55], [0.62, 0.5, 0.44], [0.48, 0.38, 0.34], [0.35, 0.27, 0.24]], { landCutoff: 0.45, cloudCover: 1.3 }), // dusky world under a red dwarf
  terran('TRAPPIST-1E', 9.4, [[0.04, 0.28, 0.3], [0.03, 0.2, 0.24], [0.01, 0.11, 0.15]], [[0.5, 0.3, 0.14], [0.62, 0.4, 0.2], [0.72, 0.5, 0.26], [0.8, 0.6, 0.34]], FAINT_WHITE_CLOUDS, { landCutoff: 0.5, cloudCover: 1.35 }),
  terran('KEPLER-452B', 1.9, [[0.06, 0.16, 0.42], [0.09, 0.24, 0.55], [0.04, 0.09, 0.26]], [[0.14, 0.36, 0.12], [0.24, 0.5, 0.18], [0.4, 0.6, 0.24], [0.6, 0.58, 0.3]], [[0.92, 0.93, 0.95], [0.78, 0.8, 0.85], [0.62, 0.65, 0.72], [0.45, 0.48, 0.55]], { landCutoff: 0.55, cloudCover: 1.2 }), // "Earth's cousin"
  terran('KEPLER-186F', 2.6, [[0.08, 0.1, 0.3], [0.06, 0.07, 0.22], [0.03, 0.03, 0.12]], [[0.5, 0.28, 0.1], [0.65, 0.38, 0.14], [0.76, 0.48, 0.18], [0.84, 0.6, 0.26]], [[0.85, 0.76, 0.68], [0.72, 0.62, 0.55], [0.58, 0.48, 0.42], [0.42, 0.35, 0.3]], { landCutoff: 0.5, cloudCover: 1.3 }), // red-dwarf light: rust vegetation
  lava('55 CANCRI E', 3.8, [[0.2, 0.16, 0.14], [0.13, 0.1, 0.09], [0.06, 0.05, 0.04]], [[0.15, 0.11, 0.09], [0.05, 0.03, 0.03]], [[1.0, 0.92, 0.55], [0.98, 0.72, 0.2], [0.85, 0.45, 0.05]], 0.52), // global magma ocean
  lava('COROT-7B', 4.9, [[0.16, 0.08, 0.06], [0.1, 0.05, 0.03], [0.05, 0.02, 0.01]], [[0.12, 0.05, 0.03], [0.04, 0.02, 0.01]], [[1.0, 0.5, 0.1], [0.88, 0.28, 0.02], [0.62, 0.12, 0.0]], 0.58),
  terran('GJ 1214 B', 5.7, [[0.12, 0.28, 0.5], [0.08, 0.2, 0.4], [0.04, 0.1, 0.24]], [[0.2, 0.38, 0.55], [0.28, 0.48, 0.65], [0.38, 0.58, 0.74], [0.5, 0.68, 0.82]], [[0.94, 0.95, 0.97], [0.84, 0.86, 0.9], [0.7, 0.74, 0.8], [0.55, 0.6, 0.68]], { landCutoff: 0.18, cloudCover: 0.95 }), // steamy waterworld, almost no land
  terran('K2-18 B', 7.3, [[0.06, 0.2, 0.44], [0.04, 0.14, 0.34], [0.02, 0.07, 0.2]], [[0.14, 0.3, 0.5], [0.2, 0.4, 0.6], [0.3, 0.5, 0.7], [0.42, 0.6, 0.78]], [[0.9, 0.93, 0.96], [0.78, 0.83, 0.9], [0.64, 0.7, 0.8], [0.5, 0.56, 0.68]], { landCutoff: 0.25, cloudCover: 1.0 }), // hycean ocean world
  rock('16 PSYCHE', 6.6, [[0.14, 0.14, 0.17], [0.35, 0.36, 0.42], [0.58, 0.6, 0.68]], 52), // exposed metal core
  // — Small wanderers —
  rock("HALLEY'S COMET", 8.1, [[0.1, 0.1, 0.12], [0.28, 0.29, 0.33], [0.62, 0.66, 0.74]], 40), // dirty snowball, ice glints on black
  rock('67P', 9.6, [[0.09, 0.08, 0.08], [0.24, 0.22, 0.21], [0.44, 0.41, 0.39]], 44), // the Rosetta comet
  rock("'OUMUAMUA", 1.8, [[0.24, 0.14, 0.08], [0.46, 0.3, 0.18], [0.68, 0.5, 0.32]], 38), // the interstellar visitor
  noAtmo('IAPETUS', 2.7, [[0.85, 0.83, 0.78], [0.62, 0.58, 0.52], [0.36, 0.32, 0.28]], [[0.14, 0.1, 0.07], [0.06, 0.04, 0.03]], 46, 12), // two-tone: bright ice, coal-dark plains
  noAtmo('TITANIA', 3.9, [[0.6, 0.56, 0.54], [0.46, 0.42, 0.41], [0.28, 0.25, 0.24]], [[0.5, 0.44, 0.42], [0.24, 0.2, 0.19]], 48, 8),
]

/**
 * Boss-sector roster, in escalating order: first the giant planets, then real stars,
 * then nebulae, galaxies, and black holes. Only true ringed worlds get a planetary ring;
 * galaxies and black holes reuse the ring quad as their disk.
 */
export const BOSS_PLANETS: RealPlanet[] = [
  gas('JUPITER', 1.5, [[0.9, 0.78, 0.62], [0.82, 0.62, 0.44], [0.68, 0.44, 0.28]], [[0.5, 0.28, 0.14], [0.32, 0.15, 0.06], [0.18, 0.07, 0.02]], { bands: 2.4, gasTimeSpeed: 0.16 }),
  gas('SATURN', 2.8, [[0.9, 0.84, 0.64], [0.8, 0.7, 0.5], [0.64, 0.54, 0.34]], [[0.47, 0.37, 0.21], [0.3, 0.22, 0.11], [0.16, 0.11, 0.05]], { bands: 1.4, ring: true }),
  gas('URANUS', 3.3, [[0.68, 0.88, 0.9], [0.52, 0.78, 0.82], [0.36, 0.62, 0.7]], [[0.24, 0.48, 0.58], [0.14, 0.34, 0.44], [0.07, 0.2, 0.3]], { bands: 0.4, gasTimeSpeed: 0.05 }), // near-featureless cyan
  gas('NEPTUNE', 4.1, [[0.3, 0.5, 0.92], [0.2, 0.38, 0.76], [0.12, 0.26, 0.58]], [[0.07, 0.16, 0.42], [0.04, 0.09, 0.28], [0.01, 0.04, 0.15]], { bands: 1.1, gasTimeSpeed: 0.2 }), // fastest winds in the solar system
  gas('HD 189733 B', 5.4, [[0.35, 0.55, 0.95], [0.24, 0.42, 0.82], [0.15, 0.3, 0.65]], [[0.09, 0.19, 0.48], [0.05, 0.11, 0.32], [0.02, 0.05, 0.18]], { bands: 1.8, gasTimeSpeed: 0.26 }), // cobalt blue, molten-glass rain
  gas('WASP-12B', 6.9, [[0.55, 0.3, 0.2], [0.4, 0.2, 0.12], [0.28, 0.12, 0.06]], [[0.16, 0.06, 0.03], [0.09, 0.03, 0.01], [0.04, 0.01, 0.0]], { bands: 1.2, gasTimeSpeed: 0.3 }), // pitch-black hot Jupiter being eaten by its star
  gas('51 PEGASI B', 7.7, [[0.85, 0.78, 0.68], [0.72, 0.64, 0.52], [0.56, 0.48, 0.38]], [[0.4, 0.33, 0.25], [0.26, 0.2, 0.14], [0.13, 0.1, 0.06]], { bands: 1.5 }), // the first exoplanet found around a sunlike star
  gas('HD 209458 B', 8.4, [[0.72, 0.8, 0.92], [0.56, 0.66, 0.84], [0.4, 0.5, 0.72]], [[0.26, 0.36, 0.58], [0.15, 0.22, 0.42], [0.07, 0.11, 0.26]], { bands: 1.3, gasTimeSpeed: 0.22 }), // "Osiris", its atmosphere boiling away
  gas('GJ 504 B', 9.2, [[0.95, 0.55, 0.75], [0.85, 0.4, 0.62], [0.68, 0.26, 0.48]], [[0.5, 0.15, 0.35], [0.34, 0.08, 0.24], [0.18, 0.03, 0.13]], { bands: 0.9 }), // young giant still glowing magenta
  gas('J1407 B', 1.1, [[0.7, 0.6, 0.5], [0.56, 0.46, 0.37], [0.42, 0.33, 0.25]], [[0.28, 0.21, 0.15], [0.17, 0.12, 0.08], [0.08, 0.05, 0.03]], { bands: 1.6, ring: true }), // "super Saturn" with a ring system 200x Saturn's
  // — Stars —
  star('THE SUN', 2.3, [[1.0, 0.96, 0.78], [0.98, 0.85, 0.45], [0.92, 0.68, 0.2]], [[0.8, 0.45, 0.08], [0.6, 0.28, 0.03], [0.4, 0.15, 0.01]]),
  star('PROXIMA CENTAURI', 3.6, [[1.0, 0.55, 0.35], [0.9, 0.4, 0.22], [0.75, 0.28, 0.12]], [[0.55, 0.16, 0.06], [0.38, 0.09, 0.03], [0.22, 0.04, 0.01]], 0.45), // flare-prone red dwarf
  star('SIRIUS', 4.4, [[0.94, 0.97, 1.0], [0.8, 0.88, 1.0], [0.62, 0.74, 0.95]], [[0.42, 0.55, 0.85], [0.26, 0.38, 0.68], [0.14, 0.22, 0.48]]), // the brightest star in our sky
  star('VEGA', 5.9, [[0.96, 0.97, 1.0], [0.85, 0.9, 0.98], [0.7, 0.78, 0.92]], [[0.5, 0.6, 0.82], [0.34, 0.42, 0.65], [0.2, 0.26, 0.46]]),
  star('ALDEBARAN', 6.2, [[1.0, 0.78, 0.5], [0.95, 0.62, 0.32], [0.85, 0.46, 0.18]], [[0.66, 0.3, 0.08], [0.48, 0.18, 0.04], [0.3, 0.1, 0.02]]), // orange giant, the bull's eye
  star('BETELGEUSE', 7.8, [[1.0, 0.6, 0.32], [0.92, 0.42, 0.18], [0.78, 0.28, 0.08]], [[0.58, 0.16, 0.03], [0.4, 0.08, 0.01], [0.24, 0.04, 0.0]], 0.4), // red supergiant, due to blow
  star('RIGEL', 8.9, [[0.88, 0.94, 1.0], [0.72, 0.84, 1.0], [0.55, 0.7, 0.95]], [[0.36, 0.52, 0.85], [0.22, 0.35, 0.68], [0.11, 0.2, 0.48]]), // blue supergiant
  star('ANTARES', 9.7, [[1.0, 0.56, 0.36], [0.9, 0.38, 0.2], [0.75, 0.24, 0.1]], [[0.55, 0.13, 0.04], [0.36, 0.07, 0.02], [0.2, 0.03, 0.01]]), // "rival of Mars"
  star('UY SCUTI', 1.4, [[0.98, 0.5, 0.28], [0.88, 0.34, 0.14], [0.72, 0.2, 0.06]], [[0.5, 0.11, 0.02], [0.32, 0.06, 0.01], [0.16, 0.02, 0.0]], 0.28), // among the largest stars known
  star('PSR B1919+21', 2.1, [[0.85, 0.95, 1.0], [0.6, 0.82, 1.0], [0.38, 0.6, 0.95]], [[0.2, 0.4, 0.8], [0.1, 0.24, 0.6], [0.04, 0.12, 0.4]], 0.6), // the first pulsar ever found
  // — Nebulae —
  nebula('ORION NEBULA', 3.2, [[0.95, 0.45, 0.65], [0.85, 0.3, 0.55], [0.68, 0.18, 0.45], [0.5, 0.1, 0.34]], [[0.35, 0.65, 0.72], [0.25, 0.5, 0.6], [0.16, 0.36, 0.48], [0.09, 0.24, 0.36]]),
  nebula('CRAB NEBULA', 4.7, [[0.95, 0.55, 0.3], [0.85, 0.38, 0.18], [0.7, 0.24, 0.1], [0.52, 0.14, 0.05]], [[0.55, 0.7, 0.85], [0.42, 0.56, 0.74], [0.3, 0.42, 0.62], [0.2, 0.3, 0.48]]), // supernova remnant of 1054 AD
  nebula('HELIX NEBULA', 5.3, [[0.45, 0.85, 0.85], [0.3, 0.7, 0.74], [0.18, 0.54, 0.62], [0.1, 0.38, 0.48]], [[0.9, 0.45, 0.3], [0.78, 0.32, 0.2], [0.62, 0.2, 0.12], [0.45, 0.12, 0.06]]), // the "Eye of God"
  nebula('EAGLE NEBULA', 6.4, [[0.9, 0.78, 0.45], [0.78, 0.62, 0.3], [0.62, 0.46, 0.18], [0.45, 0.32, 0.1]], [[0.35, 0.6, 0.55], [0.26, 0.48, 0.45], [0.17, 0.36, 0.35], [0.1, 0.25, 0.26]]), // home of the Pillars of Creation
  nebula("CAT'S EYE NEBULA", 7.6, [[0.4, 0.9, 0.75], [0.28, 0.76, 0.62], [0.18, 0.6, 0.5], [0.1, 0.44, 0.38]], [[0.55, 0.8, 0.6], [0.42, 0.66, 0.48], [0.3, 0.52, 0.37], [0.2, 0.38, 0.27]]),
  // — Galaxies —
  galaxy('ANDROMEDA', 8.3, [[1.0, 0.94, 0.8], [0.95, 0.85, 0.62], [0.85, 0.7, 0.45]], [[0.75, 0.82, 0.95], [0.55, 0.65, 0.85], [0.36, 0.46, 0.7]], [[0.22, 0.3, 0.52], [0.12, 0.18, 0.36], [0.05, 0.09, 0.22]]), // on a collision course with us
  galaxy('WHIRLPOOL GALAXY', 9.1, [[0.98, 0.92, 0.78], [0.92, 0.8, 0.58], [0.8, 0.64, 0.4]], [[0.6, 0.74, 0.95], [0.42, 0.56, 0.84], [0.26, 0.38, 0.66]], [[0.15, 0.24, 0.48], [0.08, 0.13, 0.32], [0.03, 0.06, 0.18]]),
  galaxy('SOMBRERO GALAXY', 1.6, [[1.0, 0.95, 0.85], [0.95, 0.87, 0.7], [0.86, 0.74, 0.52]], [[0.5, 0.4, 0.32], [0.36, 0.27, 0.2], [0.24, 0.17, 0.12]], [[0.15, 0.1, 0.07], [0.08, 0.05, 0.03], [0.03, 0.02, 0.01]]), // its dark dust lane is the "brim"
  // — Black holes —
  blackHole('SAGITTARIUS A*', 2.5, [[1.0, 0.72, 0.3], [0.95, 0.52, 0.12], [0.82, 0.34, 0.04]], [[0.6, 0.2, 0.02], [0.4, 0.11, 0.01], [0.22, 0.05, 0.0]]), // the monster at the Milky Way's heart
  blackHole('M87*', 3.5, [[1.0, 0.8, 0.42], [0.98, 0.6, 0.2], [0.88, 0.42, 0.08]], [[0.66, 0.26, 0.04], [0.45, 0.15, 0.02], [0.26, 0.07, 0.01]]), // the first black hole ever photographed
]

/**
 * The body shown in a given sector. Boss sectors (every `bossInterval`th) cycle the giant
 * roster in order; other sectors cycle the regular roster, indexed by how many non-boss
 * sectors precede them so no entry is skipped.
 */
export function realPlanetForStage(stage: number, bossInterval: number): RealPlanet {
  const s = Math.max(1, Math.floor(stage))
  if (bossInterval > 0 && s % bossInterval === 0) {
    return BOSS_PLANETS[(s / bossInterval - 1) % BOSS_PLANETS.length]
  }
  const bossesBefore = bossInterval > 0 ? Math.floor((s - 1) / bossInterval) : 0
  return REGULAR_PLANETS[(s - 1 - bossesBefore) % REGULAR_PLANETS.length]
}
