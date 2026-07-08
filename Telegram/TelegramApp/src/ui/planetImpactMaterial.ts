// Maps a planet's real profile.kind to material-flavored impact audio + debris tint, so a
// tap on a gas giant sounds/looks different from one on a rock or ice world.
import type { PlanetProfile } from '../planet/planetProfiles'
import { audio } from '../game/audio/AudioManager'

export interface ImpactMaterial {
  playImpactSound: () => void
  debrisColor: string
}

const MATERIALS: Record<PlanetProfile['kind'], ImpactMaterial> = {
  noAtmosphere: { playImpactSound: audio.impactRock, debrisColor: '#8a7a6a' },
  terranWet: { playImpactSound: audio.impactWet, debrisColor: '#6fa87a' },
  iceWorld: { playImpactSound: audio.impactIce, debrisColor: '#bfe8f5' },
  gasGiant: { playImpactSound: audio.impactGas, debrisColor: '#e8d8a0' },
  lavaWorld: { playImpactSound: audio.impactLava, debrisColor: '#ff8a4c' },
  asteroid: { playImpactSound: audio.impactMetal, debrisColor: '#9aa0a8' },
  nebula: { playImpactSound: audio.impactGas, debrisColor: '#e88ad8' },
}

export function impactMaterialFor(profile: PlanetProfile): ImpactMaterial {
  return MATERIALS[profile.kind]
}
