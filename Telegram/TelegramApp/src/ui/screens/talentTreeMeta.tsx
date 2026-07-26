// Shared color/icon lookup for talent nodes - split out so TalentNode.tsx/TalentsScreen.tsx only
// export components (keeps Fast Refresh happy), same split as artifactEffectMeta.ts.
//
// Deliberately NOT keyed by branch/cluster: the tree isn't meant to read as named categories -
// no legend, no per-branch color - just one continuous climb. Icons are keyed by what a node
// actually DOES (its effect), which two different branches can share, rather than which of the
// 4 branches it happens to sit in.
import type { ReactElement } from 'react'
import { TalentEffect } from '../../game/config/TalentDefinition'
import { TalentAssaultIcon, TalentPrecisionIcon, TalentWealthIcon, TalentContinuumIcon, TalentTrunkIcon, GemIcon } from '../icons'

/** One uniform accent for every regular investable node (trunk, wing, and all 4 branches).
 *  Gem sockets and the Grand Nexus get their own colors in TalentNode.tsx - those are distinct
 *  structural roles, not categories. */
export const TALENT_NODE_COLOR = '#43DDEE'

export function effectIcon(effect: TalentEffect): ReactElement {
  switch (effect) {
    case TalentEffect.TapDamage:
    case TalentEffect.Dps:
      return <TalentAssaultIcon />
    case TalentEffect.Gold:
    case TalentEffect.XpGain:
      return <TalentWealthIcon />
    case TalentEffect.TapCritChance:
    case TalentEffect.ShipCritChance:
      return <TalentPrecisionIcon />
    case TalentEffect.OfflineReward:
    case TalentEffect.RelicGain:
      return <TalentContinuumIcon />
    case TalentEffect.Capstone:
      return <TalentTrunkIcon />
    case TalentEffect.GemSocket:
      return <GemIcon />
  }
}
