// Ported from GamePhone.dc.html's Artifacts screen. Shows every artifact as a real,
// interactive row once unlocked; the 3 late-unlock ones (see #13, ArtifactDefinition.ts) render
// as a locked placeholder with their real unlock requirement until then.
import type { GameSession } from '../../game/gameplay/GameSession'
import { artifactUnlockLabel } from '../../game/config/ArtifactDefinition'
import { ArtifactRow } from './ArtifactRow'
import { effectLabel } from './artifactEffectMeta'
import { LockedArtifactRow } from './LockedArtifactRow'
import { ArtifactPhoenixIcon, ArtifactVoidglassIcon, ArtifactBeaconIcon } from '../icons'

interface ArtifactsScreenProps {
  session: GameSession
  onToast: (text: string) => void
}

const LOCKED_ICONS = [<ArtifactPhoenixIcon key="phoenix" />, <ArtifactVoidglassIcon key="voidglass" />, <ArtifactBeaconIcon key="beacon" />]

export function ArtifactsScreen({ session: s, onToast }: ArtifactsScreenProps) {
  let lockedSeen = 0
  return (
    <div className="screen artifacts-screen">
      <div className="screen-header">
        <div className="screen-title">ARTIFACTS</div>
        <div className="screen-subtitle">PERMANENT BONUSES</div>
      </div>
      <div className="artifact-list">
        {Array.from({ length: s.artifacts.count }, (_, i) => {
          if (s.isArtifactUnlocked(i)) return <ArtifactRow key={i} session={s} index={i} onToast={onToast} />
          const def = s.artifacts.def(i)
          const icon = LOCKED_ICONS[lockedSeen % LOCKED_ICONS.length]
          lockedSeen++
          return <LockedArtifactRow key={i} icon={icon} name={def.displayName} effectLabel={`+${effectLabel(def.effect)}`} unlockLabel={artifactUnlockLabel(def)} />
        })}
      </div>
    </div>
  )
}
