// User-requested: a clear, explicit callout on boss kill - the existing pack-drop particle
// (see GameShell.tsx's spawnPackDrop) shows the pack flying to the CARDS tab, but never states
// in words that a pack was earned. This is that missing text, separate from the generic reward
// toast so it can't be starved out by other toasts firing around the same moment.
interface PackEarnedBannerProps {
  visible: boolean
}

export function PackEarnedBanner({ visible }: PackEarnedBannerProps) {
  if (!visible) return null
  return (
    <div className="pack-earned-banner">
      <span className="pack-earned-banner-icon">✦</span>
      <span className="pack-earned-banner-text">NEW CARD PACK EARNED</span>
      <span className="pack-earned-banner-icon">✦</span>
    </div>
  )
}
