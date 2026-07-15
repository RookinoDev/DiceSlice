// Ported from GamePhone.dc.html's Artifacts row. Icon looks matched to our real artifacts by
// effect type: DPS -> Gravity Anchor look, Gold -> Star Chart look, TapDamage -> Helios Core look.
import { useState } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { ArtifactEffect, artifactBonusAt } from '../../game/config/ArtifactDefinition'
import { hapticAction } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { ArtifactGravityIcon, ArtifactStarChartIcon, ArtifactHeliosIcon, ArtifactPhoenixIcon, ArtifactVoidglassIcon, ArtifactBeaconIcon } from '../icons'
import { effectLabel, effectIconBg } from './artifactEffectMeta'

function EffectIcon({ effect }: { effect: ArtifactEffect }) {
  switch (effect) {
    case ArtifactEffect.Dps:
      return <ArtifactGravityIcon />
    case ArtifactEffect.Gold:
      return <ArtifactStarChartIcon />
    case ArtifactEffect.OfflineReward:
      return <ArtifactPhoenixIcon />
    case ArtifactEffect.TapCritChance:
      return <ArtifactVoidglassIcon />
    case ArtifactEffect.ShipCritChance:
      return <ArtifactBeaconIcon />
    default:
      return <ArtifactHeliosIcon />
  }
}

interface ArtifactRowProps {
  session: GameSession
  index: number
  onToast: (text: string) => void
}

export function ArtifactRow({ session: s, index, onToast }: ArtifactRowProps) {
  const arts = s.artifacts
  const def = arts.def(index)
  const lvl = arts.levelOf(index)
  const pct = Math.round(artifactBonusAt(def, lvl) * 100)
  const afford = s.prestige.relics.canAfford(arts.nextCost(index))
  const [popKey, setPopKey] = useState(0)

  return (
    <div className="artifact-row">
      <div key={popKey} className="row-icon-wrap row-icon-pop" style={{ background: effectIconBg(def.effect) }}>
        <EffectIcon effect={def.effect} />
      </div>
      <div className="row-info">
        <div className="row-name">{def.displayName}</div>
        <div className="row-class">LV.{lvl}</div>
        <div className="row-detail accent">
          +{pct}% {effectLabel(def.effect)}
        </div>
      </div>
      <button
        className={`artifact-row-action ${afford ? 'affordable' : ''}`}
        onClick={() => {
          if (s.buyArtifact(index)) {
            hapticAction()
            audio.purchase()
            setPopKey((k) => k + 1)
          } else onToast('NOT ENOUGH RELICS')
        }}
      >
        <div className="row-action-label">UPGRADE</div>
        <div className="row-action-cost">{arts.nextCost(index).toShortString()} R</div>
      </button>
    </div>
  )
}
