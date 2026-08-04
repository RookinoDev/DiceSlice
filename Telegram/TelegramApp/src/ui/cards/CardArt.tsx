// A card's artwork window. The grid can't afford a live WebGL render per cell (browsers cap
// simultaneous contexts well under the 66 cards in Set 1), so each card's real planet is
// rendered once (see useCardThumbnail.ts) and shown as a plain cached image there; the single
// focused/detail card still gets the real live shader render - the same PlanetCanvas the combat
// screen uses, so the card's art IS the object, not a picture of it.
import { lazy, Suspense, type CSSProperties } from 'react'
import { realPlanetByName } from '../../planet/realPlanets'
import type { RealPlanet } from '../../planet/realPlanets'
import { primaryColorForProfile } from './cardArtColor'
import { useCardThumbnail } from './useCardThumbnail'

const PlanetCanvas = lazy(() => import('../../planet/PlanetCanvas').then((m) => ({ default: m.PlanetCanvas })))

interface CardArtProps {
  cardName: string
  mode: 'grid' | 'focused'
  className?: string
}

export function CardArt({ cardName, mode, className }: CardArtProps) {
  const target = realPlanetByName(cardName)

  if (mode === 'grid') return <CardArtGrid cardName={cardName} target={target} className={className} />
  if (!target) return <div className={`card-art card-art-missing ${className ?? ''}`} />

  return (
    <Suspense fallback={<div className={`card-art card-art-loading ${className ?? ''}`} />}>
      <PlanetCanvas profile={target.profile} className={`card-art card-art-live ${className ?? ''}`} />
    </Suspense>
  )
}

/** Split out so the missing-target case (no hooks called) and the real grid case (hook always
 *  called) are never the same component instance - keeps useCardThumbnail unconditional. */
function CardArtGrid({ cardName, target, className }: { cardName: string; target: RealPlanet | undefined; className?: string }) {
  if (!target) return <div className={`card-art card-art-missing ${className ?? ''}`} />
  return <CardArtGridResolved cardName={cardName} target={target} className={className} />
}

function CardArtGridResolved({ cardName, target, className }: { cardName: string; target: RealPlanet; className?: string }) {
  const color = primaryColorForProfile(target.profile)
  const thumbUrl = useCardThumbnail(cardName, target.profile)
  // The gradient swatch stays underneath as the loading/fallback state (see .card-art-swatch in
  // ui.css) - the real pre-rendered planet pops in over it once resolved, never a jarring swap
  // from "colored ball" to "blank" while waiting.
  return (
    <div className={`card-art card-art-swatch ${className ?? ''}`} style={{ '--art-color': color } as CSSProperties}>
      {thumbUrl && <img src={thumbUrl} alt="" className="card-art-thumb" draggable={false} />}
    </div>
  )
}
