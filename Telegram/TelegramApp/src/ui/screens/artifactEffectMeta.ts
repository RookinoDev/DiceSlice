// Shared label/color lookup for artifact effects - split from ArtifactRow.tsx so that
// component file only exports components (keeps Fast Refresh happy).
import { ArtifactEffect } from '../../game/config/ArtifactDefinition'

export function effectLabel(effect: ArtifactEffect): string {
  switch (effect) {
    case ArtifactEffect.Dps:
      return 'Fleet DPS'
    case ArtifactEffect.Gold:
      return 'Gold Gain'
    case ArtifactEffect.TapDamage:
      return 'Tap Damage'
    case ArtifactEffect.OfflineReward:
      return 'Offline Rewards'
    case ArtifactEffect.TapCritChance:
      return 'Tap Crit Chance'
    case ArtifactEffect.ShipCritChance:
      return 'Fleet Crit Chance'
    default:
      return ''
  }
}

export function effectIconBg(effect: ArtifactEffect): string {
  switch (effect) {
    case ArtifactEffect.Dps:
      return 'rgba(67,221,238,0.12)'
    case ArtifactEffect.Gold:
      return 'rgba(255,216,115,0.12)'
    case ArtifactEffect.TapDamage:
      return 'rgba(255,178,56,0.12)'
    case ArtifactEffect.OfflineReward:
      return 'rgba(255,124,67,0.12)'
    case ArtifactEffect.TapCritChance:
      return 'rgba(180,130,255,0.12)'
    case ArtifactEffect.ShipCritChance:
      return 'rgba(180,130,255,0.12)'
    default:
      return 'rgba(255,255,255,0.06)'
  }
}
