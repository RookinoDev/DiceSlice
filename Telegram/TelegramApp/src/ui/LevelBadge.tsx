// Clash-Royale-style level badge: a numbered shield + an XP bar labeled with the raw
// current/target numbers (not just a bare fill - the badge should read as real progress, not
// just decoration). Used compact in TopBar next to the Profile button (clickable -> Talents
// tab) and large atop TalentsScreen (not clickable, already there). A plain width-transition
// div is simpler than porting useCountUp here - a bar wants smooth width motion, not a ticking
// number.
interface LevelBadgeProps {
  level: number
  xp: number
  xpToNextLevel: number
  onClick?: () => void
  size?: 'compact' | 'large'
}

export function LevelBadge({ level, xp, xpToNextLevel, onClick, size = 'compact' }: LevelBadgeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, xpToNextLevel > 0 ? xp / xpToNextLevel : 0)) * 100)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`level-badge level-badge--${size}`} onClick={onClick} aria-label={`Level ${level}, ${xp} of ${xpToNextLevel} XP`}>
      <span className="level-badge-shield">{level}</span>
      <span className="level-xp-track">
        <span className="level-xp-fill" style={{ width: `${pct}%` }} />
        <span className="level-xp-label">
          {xp.toLocaleString()}/{xpToNextLevel.toLocaleString()}
        </span>
      </span>
    </Tag>
  )
}
