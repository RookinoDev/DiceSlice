// Shared icon lookup for talent branches - split out so TalentNode.tsx/TalentsScreen.tsx only
// export components (keeps Fast Refresh happy), same split as artifactEffectMeta.ts.
//
// Unlike the previous uncategorized design, THIS tree wants strong branch identity - 5 named,
// differently-colored branches (see TalentDefinition.ts's BRANCH_LABEL/BRANCH_COLOR) - so icons
// are keyed by branch here, not by effect.
import type { ReactElement } from 'react'
import type { TalentBranch } from '../../game/config/TalentDefinition'
import { TalentAssaultIcon, TalentFleetDroneIcon, TalentTrunkIcon, TalentWealthIcon, TalentContinuumIcon, TalentCapstoneIcon } from '../icons'

export function branchIcon(branch: TalentBranch | 'combo'): ReactElement {
  switch (branch) {
    case 'cannon':
      return <TalentAssaultIcon />
    case 'fleet':
      return <TalentFleetDroneIcon />
    case 'core':
      return <TalentTrunkIcon />
    case 'salvage':
      return <TalentWealthIcon />
    case 'warp':
      return <TalentContinuumIcon />
    case 'combo':
      return <TalentCapstoneIcon />
  }
}
