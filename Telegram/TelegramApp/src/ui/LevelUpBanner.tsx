// The talent tree's level-up celebration - same drop-down-banner shape as PackEarnedBanner.tsx
// (remount via a key bump on the caller side replays the CSS entrance animation).
interface LevelUpBannerProps {
  visible: boolean
  level: number
}

export function LevelUpBanner({ visible, level }: LevelUpBannerProps) {
  if (!visible) return null
  return (
    <div className="levelup-banner">
      <span className="levelup-banner-icon">★</span>
      <span className="levelup-banner-text">LEVEL UP · LV {level}</span>
      <span className="levelup-banner-sub">+1 TALENT POINT</span>
      <span className="levelup-banner-icon">★</span>
    </div>
  )
}
