// One branch's own panel: a 2-column grid of its 4 tiers (2 talents each), its 2 Gem Sockets,
// and its capstone - replacing the old SVG fork/merge connector rendering entirely. This design
// doesn't need connector lines at all: unlock is "N points already spent in this branch" (a
// threshold, not a specific prerequisite node), so there's nothing to literally draw a line
// between - see TalentDefinition.ts's isTalentNodeUnlocked.
//
// Reads bottom-to-top like a climb: the capstone (the branch's biggest payoff) sits at the TOP
// of the panel, tier 1 (cheap, always unlocked) at the very BOTTOM - the reverse of the tier
// THRESHOLD order (0/5/12/22/35), which only describes unlock cost, not layout direction.
import type { GameSession } from '../../game/gameplay/GameSession'
import { BRANCH_LABEL, BRANCH_COLOR, type TalentBranch } from '../../game/config/TalentDefinition'
import { TalentNode } from './TalentNode'
import { branchIcon } from './talentTreeMeta'
import type { CSSProperties } from 'react'

interface BranchPanelProps {
  session: GameSession
  branch: TalentBranch
  /** This branch's own node indices, in the order buildDefaultTalents wrote them: 8 tier talents
   *  (4 tiers x 2), then the capstone, then 2 Gem Sockets. */
  nodeIndices: number[]
  onToast: (text: string) => void
  onOpenSocket?: (nodeId: string) => void
}

export function BranchPanel({ session: s, branch, nodeIndices, onToast, onOpenSocket }: BranchPanelProps) {
  const t = s.talents
  const tierIndices = nodeIndices.slice(0, 8)
  const capstoneIndex = nodeIndices[8]
  const gemIndices = nodeIndices.slice(9)

  // Tier 4's pair first (renders at the top of the grid), tier 1's pair last (renders at the
  // bottom) - each pair's own left-right order stays intact, only the tier ROWS flip.
  const tierRows: number[][] = [tierIndices.slice(0, 2), tierIndices.slice(2, 4), tierIndices.slice(4, 6), tierIndices.slice(6, 8)]
  const bottomUpTierIndices = [...tierRows].reverse().flat()

  const pointsSpent = nodeIndices.reduce((sum, i) => sum + t.levelOf(i), 0)
  const maxPoints = nodeIndices.reduce((sum, i) => sum + t.def(i).maxLevel, 0)

  return (
    <div className="branch-panel" style={{ '--branch-color': BRANCH_COLOR[branch] } as CSSProperties}>
      <div className="branch-panel-header">
        <span className="branch-panel-icon">{branchIcon(branch)}</span>
        <span className="branch-panel-label">{BRANCH_LABEL[branch]}</span>
        <span className="branch-panel-points">
          {pointsSpent}/{maxPoints}
        </span>
      </div>
      <div className="branch-capstone-row">
        <TalentNode session={s} index={capstoneIndex} onToast={onToast} onOpenSocket={onOpenSocket} />
      </div>
      <div className="branch-gem-row">
        {gemIndices.map((i) => (
          <TalentNode key={i} session={s} index={i} onToast={onToast} onOpenSocket={onOpenSocket} />
        ))}
      </div>
      <div className="branch-tier-grid">
        {bottomUpTierIndices.map((i) => (
          <TalentNode key={i} session={s} index={i} onToast={onToast} onOpenSocket={onOpenSocket} />
        ))}
      </div>
    </div>
  )
}
