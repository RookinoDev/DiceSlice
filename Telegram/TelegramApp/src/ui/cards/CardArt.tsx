// A card's artwork window. The grid can't afford a live WebGL render per cell (browsers cap
// simultaneous contexts well under the 66 cards in Set 1), so it shows a lightweight color-true
// placeholder there; the single focused/detail card gets the real live shader render - the same
// PlanetCanvas the combat screen uses, so the card's art IS the object, not a picture of it.
import { lazy, Suspense, type CSSProperties } from 'react'
import { realPlanetByName } from '../../planet/realPlanets'
import { primaryColorForProfile } from './cardArtColor'

const PlanetCanvas = lazy(() => import('../../planet/PlanetCanvas').then((m) => ({ default: m.PlanetCanvas })))

interface CardArtProps {
  cardName: string
  mode: 'grid' | 'focused'
  className?: string
}

export function CardArt({ cardName, mode, className }: CardArtProps) {
  const target = realPlanetByName(cardName)
  if (!target) return <div className={`card-art card-art-missing ${className ?? ''}`} />

  if (mode === 'grid') {
    const color = primaryColorForProfile(target.profile)
    // A crisp circular orb (highlight + true sphere falloff to transparent), not a formless
    // blur - see .card-art-swatch in ui.css for the actual gradient stack this variable feeds.
    return <div className={`card-art card-art-swatch ${className ?? ''}`} style={{ '--art-color': color } as CSSProperties} />
  }

  return (
    <Suspense fallback={<div className={`card-art card-art-loading ${className ?? ''}`} />}>
      <PlanetCanvas profile={target.profile} className={`card-art card-art-live ${className ?? ''}`} />
    </Suspense>
  )
}
