// "LV n" chip + a thin XP fill bar. Used compact in TopBar (clickable -> Talents tab) and large
// atop TalentsScreen (not clickable, already there). A plain width-transition div is simpler than
// porting useCountUp here - a bar wants smooth width motion, not a ticking number.
import { LevelStarIcon } from './icons'

interface LevelBadgeProps {
  level: number
  /** 0..1 */
  xpFraction: number
  onClick?: () => void
  size?: 'compact' | 'large'
}

export function LevelBadge({ level, xpFraction, onClick, size = 'compact' }: LevelBadgeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, xpFraction)) * 100)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`level-badge level-badge--${size}`} onClick={onClick} aria-label={`Level ${level}`}>
      <span className="level-badge-chip">
        <LevelStarIcon />
        <span>LV {level}</span>
      </span>
      <span className="level-xp-track">
        <span className="level-xp-fill" style={{ width: `${pct}%` }} />
      </span>
    </Tag>
  )
}
