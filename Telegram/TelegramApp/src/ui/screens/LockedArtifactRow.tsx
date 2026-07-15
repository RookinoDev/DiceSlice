// Placeholder for one of the 3 real-but-locked artifacts (see #13, ArtifactDefinition.ts's
// unlock conditions) until its unlock condition is met - shows what actually unlocks it instead
// of a generic "coming soon", since these are now backed by a real system, not a design promise.
import type { ReactNode } from 'react'
import { LockIcon } from '../icons'

interface LockedArtifactRowProps {
  icon: ReactNode
  name: string
  effectLabel: string
  unlockLabel: string
}

export function LockedArtifactRow({ icon, name, effectLabel, unlockLabel }: LockedArtifactRowProps) {
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
        <div>{unlockLabel}</div>
      </div>
    </div>
  )
}
