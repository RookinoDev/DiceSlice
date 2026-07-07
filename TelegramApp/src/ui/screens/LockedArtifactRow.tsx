// Static "coming soon" placeholder for the 3 designed artifacts (Offline Rewards, Crit Chance,
// Relics-on-Prestige bonus) that have no backing system in the real game yet - not wired to any
// purchase logic, per the explicit scope decision to show-but-lock rather than hide or fake them.
import type { ReactNode } from 'react'
import { LockIcon } from '../icons'

interface LockedArtifactRowProps {
  icon: ReactNode
  name: string
  effectLabel: string
}

export function LockedArtifactRow({ icon, name, effectLabel }: LockedArtifactRowProps) {
  return (
    <div className="artifact-row is-locked">
      <div className="row-icon-wrap" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {icon}
      </div>
      <div className="row-info">
        <div className="row-name is-locked">{name}</div>
        <div className="row-class">{effectLabel}</div>
      </div>
      <div className="row-unlock-req">
        <LockIcon />
        <div>Coming soon</div>
      </div>
    </div>
  )
}
