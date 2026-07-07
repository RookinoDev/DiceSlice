// Ported from GamePhone.dc.html's Artifacts screen. Shows our 3 real, interactive artifacts
// plus 3 locked placeholders for designed effects (Offline Rewards, Crit Chance, Relics-on-
// Prestige bonus) the game doesn't compute yet - see LockedArtifactRow.
import type { GameSession } from '../../game/gameplay/GameSession'
import { ArtifactRow } from './ArtifactRow'
import { LockedArtifactRow } from './LockedArtifactRow'
import { ArtifactPhoenixIcon, ArtifactVoidglassIcon, ArtifactBeaconIcon } from '../icons'

interface ArtifactsScreenProps {
  session: GameSession
  onToast: (text: string) => void
}

export function ArtifactsScreen({ session: s, onToast }: ArtifactsScreenProps) {
  return (
    <div className="screen artifacts-screen">
      <div className="screen-header">
        <div className="screen-title">ARTIFACTS</div>
        <div className="screen-subtitle">PERMANENT BONUSES</div>
      </div>
      <div className="artifact-list">
        {Array.from({ length: s.artifacts.count }, (_, i) => (
          <ArtifactRow key={i} session={s} index={i} onToast={onToast} />
        ))}
        <LockedArtifactRow icon={<ArtifactPhoenixIcon />} name="Phoenix Cinders" effectLabel="+Offline Rewards" />
        <LockedArtifactRow icon={<ArtifactVoidglassIcon />} name="Voidglass Lens" effectLabel="+Crit Chance" />
        <LockedArtifactRow icon={<ArtifactBeaconIcon />} name="Ancestral Beacon" effectLabel="+Relics on Prestige" />
      </div>
    </div>
  )
}
