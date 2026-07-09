// A single representative color per shader profile, for the collection grid's lightweight
// placeholder (see CardArt.tsx) - the grid can't afford a live WebGL render per cell (browsers
// cap simultaneous contexts well under 66), so it shows a color-true swatch instead and saves
// the real live render for the one card the player has focused.
import type { PlanetProfile } from '../../planet/planetProfiles'
import type { RGB } from '../../planet/themes'

function toCss([r, g, b]: RGB): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}

export function primaryColorForProfile(profile: PlanetProfile): string {
  switch (profile.kind) {
    case 'noAtmosphere':
    case 'lavaWorld':
      return toCss(profile.groundColors[1] ?? profile.groundColors[0])
    case 'terranWet':
      return toCss(profile.landColors[1] ?? profile.landColors[0])
    case 'gasGiant':
      // Black holes and galaxies are gasGiant profiles wearing a ring as their disk (see
      // realPlanets.ts's blackHole()/galaxy() builders) - the disk, not the near-black or
      // dim body underneath, is their real visual signature, so prefer it when present.
      return toCss(profile.ringColors?.[0] ?? profile.lightColors[1] ?? profile.lightColors[0])
    case 'iceWorld':
      return toCss(profile.landColors[0])
    case 'asteroid':
      return toCss(profile.colors[1] ?? profile.colors[0])
    case 'nebula':
      return toCss(profile.innerColors[0])
    default:
      return '#8b93ac'
  }
}
