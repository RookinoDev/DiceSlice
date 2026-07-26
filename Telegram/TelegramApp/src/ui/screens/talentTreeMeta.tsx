// Shared label/color/icon lookup for talent clusters - split out so TalentNode.tsx/TalentsScreen.tsx
// only export components (keeps Fast Refresh happy), same split as artifactEffectMeta.ts.
import type { ReactElement } from 'react'
import type { TalentCluster } from '../../game/config/TalentDefinition'
import { TalentAssaultIcon, TalentFleetIcon, TalentWealthIcon, TalentAscendantIcon, TalentCapstoneIcon } from '../icons'

export const CLUSTER_LABEL: Record<TalentCluster, string> = {
  assault: 'ASSAULT',
  armada: 'ARMADA',
  wealth: 'WEALTH',
  ascendant: 'ASCENDANT',
  precision: 'PRECISION',
  continuum: 'CONTINUUM',
}

export const CLUSTER_COLOR: Record<TalentCluster, string> = {
  assault: '#FF6B6B',
  armada: '#43DDEE',
  wealth: '#FFD873',
  ascendant: '#7CFFB2',
  precision: '#FF9F5A',
  continuum: '#B07CFF',
}

// Precision/Continuum reuse existing icons for now (topology comes before art in this rollout -
// see the M6 polish milestone) rather than block the tree's structure on new icon art.
export function clusterIcon(branch: TalentCluster | 'nexus'): ReactElement {
  switch (branch) {
    case 'assault':
      return <TalentAssaultIcon />
    case 'armada':
      return <TalentFleetIcon />
    case 'wealth':
      return <TalentWealthIcon />
    case 'ascendant':
      return <TalentAscendantIcon />
    case 'precision':
      return <TalentAssaultIcon />
    case 'continuum':
      return <TalentWealthIcon />
    case 'nexus':
      return <TalentCapstoneIcon />
  }
}
