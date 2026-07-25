// Shared label/color/icon lookup for talent branches - split out so TalentNode.tsx/TalentsScreen.tsx
// only export components (keeps Fast Refresh happy), same split as artifactEffectMeta.ts.
import type { ReactElement } from 'react'
import type { TalentBranch } from '../../game/config/TalentDefinition'
import { TalentAssaultIcon, TalentFleetIcon, TalentWealthIcon, TalentAscendantIcon, TalentCapstoneIcon } from '../icons'

export const BRANCH_LABEL: Record<TalentBranch, string> = {
  assault: 'ASSAULT',
  fleet: 'FLEET COMMAND',
  wealth: 'WEALTH',
  ascendant: 'ASCENDANT',
}

export const BRANCH_COLOR: Record<TalentBranch, string> = {
  assault: '#FF6B6B',
  fleet: '#43DDEE',
  wealth: '#FFD873',
  ascendant: '#7CFFB2',
}

export function branchIcon(branch: TalentBranch | 'capstone'): ReactElement {
  switch (branch) {
    case 'assault':
      return <TalentAssaultIcon />
    case 'fleet':
      return <TalentFleetIcon />
    case 'wealth':
      return <TalentWealthIcon />
    case 'ascendant':
      return <TalentAscendantIcon />
    case 'capstone':
      return <TalentCapstoneIcon />
  }
}
