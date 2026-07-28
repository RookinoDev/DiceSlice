// The talent tree: 5 named branches (Cannon, Fleet, Core, Salvage, Warp - see TalentDefinition.ts
// for the full design), each its own panel, with a combo talent bridging every adjacent pair in
// the ring (Cannon-Fleet, Fleet-Core, Core-Salvage, Salvage-Warp, and Warp-Cannon wrapping back
// to the start). Unlike the earlier single connected tree, there's no SVG/connector rendering
// here at all - unlock is "N points spent in this branch," a threshold check, not a graph edge.
import type { GameSession } from '../../game/gameplay/GameSession'
import { BRANCH_ORDER, type TalentBranch } from '../../game/config/TalentDefinition'
import { LevelBadge } from '../LevelBadge'
import { BranchPanel } from './BranchPanel'
import { TalentNode } from './TalentNode'
import { registerLandmark } from '../combatFx/landmarks'

interface TalentsScreenProps {
  session: GameSession
  onToast: (text: string) => void
  onOpenSocket?: (nodeId: string) => void
}

export function TalentsScreen({ session: s, onToast, onOpenSocket }: TalentsScreenProps) {
  const t = s.talents
  const allDefs = Array.from({ length: t.count }, (_, i) => t.def(i))

  const branchIndices = (branch: TalentBranch): number[] => allDefs.map((_, i) => i).filter((i) => allDefs[i].branch === branch)
  const comboIndexBetween = (a: TalentBranch, b: TalentBranch): number => allDefs.findIndex((d) => d.id === `combo-${a}-${b}`)

  return (
    <div className="screen talents-screen">
      <div className="screen-header">
        <div className="screen-title">TALENT TREE</div>
        <div className="screen-subtitle">PERMANENT BONUSES FROM COMBAT XP</div>
      </div>

      <div
        className={`talent-tree-summary ${t.unspentPoints > 0 ? 'talent-tree-summary--spendable' : ''}`}
        // See TutorialSteps.ts's 'talents-spend' step, the in-screen half of the Talent Tree
        // tutorial (nav-talents in BottomNav.tsx is the other half). Points at this summary
        // strip rather than any specific node - which node to spend on first is the player's
        // own call, not something the tutorial should imply an answer to.
        ref={(el) => registerLandmark('talents-summary', el)}
      >
        <LevelBadge level={t.level} xp={t.xp} xpToNextLevel={t.xpToNextLevel()} size="large" />
        <div className="talent-points-available">
          {t.unspentPoints} POINT{t.unspentPoints === 1 ? '' : 'S'} AVAILABLE
        </div>
      </div>

      {BRANCH_ORDER.map((branch, i) => {
        const nextBranch = BRANCH_ORDER[(i + 1) % BRANCH_ORDER.length]
        const comboIndex = comboIndexBetween(branch, nextBranch)
        return (
          <div key={branch} className="branch-section">
            <BranchPanel session={s} branch={branch} nodeIndices={branchIndices(branch)} onToast={onToast} onOpenSocket={onOpenSocket} />
            {comboIndex >= 0 && (
              <div className="combo-row">
                <TalentNode session={s} index={comboIndex} onToast={onToast} onOpenSocket={onOpenSocket} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
