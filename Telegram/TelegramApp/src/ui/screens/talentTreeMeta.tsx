// Shared label/color/icon lookup for talent clusters - split out so TalentNode.tsx/TalentsScreen.tsx
// only export components (keeps Fast Refresh happy), same split as artifactEffectMeta.ts.
import type { ReactElement } from 'react'
import type { TalentCluster } from '../../game/config/TalentDefinition'
import { TalentAssaultIcon, TalentPrecisionIcon, TalentWealthIcon, TalentContinuumIcon, TalentTrunkIcon, TalentCapstoneIcon } from '../icons'

export const CLUSTER_LABEL: Record<TalentCluster, string> = {
  combat: 'COMBAT',
  precision: 'PRECISION',
  economy: 'ECONOMY',
  continuum: 'CONTINUUM',
}

export const CLUSTER_COLOR: Record<TalentCluster, string> = {
  combat: '#FF6B6B',
  precision: '#FF9F5A',
  economy: '#FFD873',
  continuum: '#B07CFF',
}

export function clusterIcon(branch: TalentCluster | 'trunk' | 'nexus'): ReactElement {
  switch (branch) {
    case 'combat':
      return <TalentAssaultIcon />
    case 'precision':
      return <TalentPrecisionIcon />
    case 'economy':
      return <TalentWealthIcon />
    case 'continuum':
      return <TalentContinuumIcon />
    case 'trunk':
      return <TalentTrunkIcon />
    case 'nexus':
      return <TalentCapstoneIcon />
  }
}
