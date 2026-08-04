// Resolves a card's real pre-rendered planet thumbnail (see ../../planet/planetThumbnail.ts +
// thumbnailCache.ts), for CardArt.tsx's grid mode. Returns null while unresolved - the caller
// falls back to the flat gradient swatch until this comes back, then swaps to the real image.
import { useEffect, useState } from 'react'
import type { PlanetProfile } from '../../planet/planetProfiles'
import { getThumbnail, putThumbnail } from './thumbnailCache'

/** 2x a roughly 110-120px CSS display box (see .card-art in ui.css) - sharp on high-DPI without
 *  rendering (and caching) far more pixels than any card ever actually shows. */
const THUMBNAIL_SIZE_PX = 256

// Resolved object URLs live for the whole session (cards remount constantly as the virtualized
// grid scrolls - see CardGridItem.tsx - so this is what makes revisiting a card instant instead
// of re-hitting IndexedDB every time). Not revoked: the tab reloading is what reclaims them.
const resolvedUrls = new Map<string, string>()
// Dedupes concurrent resolutions of the same card (e.g. React StrictMode's double-invoke, or
// scrolling away and back before the first resolution lands).
const inFlight = new Map<string, Promise<string>>()

// Renders happen one at a time - each spins up and tears down its own WebGL context (see
// planetThumbnail.ts), and docs/CARD_SYSTEM_PLAN.md's two-context budget means scrolling fast
// through several never-cached cards shouldn't try to open them all at once.
let queueTail: Promise<unknown> = Promise.resolve()
function enqueueRender(job: () => Promise<Blob>): Promise<Blob> {
  const result = queueTail.then(job, job)
  queueTail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

// Dynamically imported, not a top-level import - planetThumbnail.ts pulls in PlanetCanvas.tsx's
// Three.js/GLSL machinery (previously a separate ~500KB lazy chunk, only loaded when the
// focused/detail card mounts). A static import here would drag all of that into the MAIN
// bundle, since useCardThumbnail runs for every grid card - see the [INEFFECTIVE_DYNAMIC_IMPORT]
// build warning this fixes. The common case (cache hit) never touches this import at all.
async function renderThumbnail(profile: PlanetProfile): Promise<Blob> {
  const { renderPlanetThumbnail } = await import('../../planet/planetThumbnail')
  return renderPlanetThumbnail(profile, THUMBNAIL_SIZE_PX)
}

async function resolveThumbnail(cardName: string, profile: PlanetProfile): Promise<string> {
  const cached = resolvedUrls.get(cardName)
  if (cached) return cached
  const pending = inFlight.get(cardName)
  if (pending) return pending

  const promise = (async () => {
    try {
      const cachedBlob = await getThumbnail(cardName)
      const blob = cachedBlob ?? (await enqueueRender(() => renderThumbnail(profile)))
      if (!cachedBlob) await putThumbnail(cardName, blob).catch(() => {}) // a cache write failure shouldn't stop the image from showing
      const url = URL.createObjectURL(blob)
      resolvedUrls.set(cardName, url)
      return url
    } finally {
      inFlight.delete(cardName)
    }
  })()
  inFlight.set(cardName, promise)
  return promise
}

export function useCardThumbnail(cardName: string, profile: PlanetProfile): string | null {
  const [url, setUrl] = useState<string | null>(() => resolvedUrls.get(cardName) ?? null)

  useEffect(() => {
    if (url) return
    let cancelled = false
    resolveThumbnail(cardName, profile)
      .then((resolvedUrl) => {
        if (!cancelled) setUrl(resolvedUrl)
      })
      .catch(() => {}) // stays null - swatch fallback covers rendering failures (e.g. no WebGL)
    return () => {
      cancelled = true
    }
  }, [cardName, profile, url])

  return url
}
