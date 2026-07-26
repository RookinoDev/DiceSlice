// The talent tree: 4 branch columns (linear 6-node chains, tier 6 at top down to tier 1 at
// bottom - node i requires node i-1 in the same branch owned) converging on 1 capstone card at
// the top. Simpler than a free-form branching graph (no line-geometry/measurement code needed -
// connectors are just CSS bars between DOM-adjacent nodes), while still reading as a real tree.
import type { GameSession } from '../../game/gameplay/GameSession'
import { BRANCH_ORDER, talentUnlockLabel, type TalentBranch } from '../../game/config/TalentDefinition'
import { LevelBadge } from '../LevelBadge'
import { TalentNode } from './TalentNode'
import { BRANCH_LABEL, BRANCH_COLOR } from './talentTreeMeta'

interface TalentsScreenProps {
  session: GameSession
  onToast: (text: string) => void
}

export function TalentsScreen({ session: s, onToast }: TalentsScreenProps) {
  const t = s.talents
  const defs = Array.from({ length: t.count }, (_, i) => t.def(i))
  const capstoneIndex = defs.findIndex((d) => d.branch === 'capstone')
  const capstoneUnlocked = capstoneIndex >= 0 && t.isUnlocked(capstoneIndex)

  const branchIndices = (branch: TalentBranch): number[] =>
    defs
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.branch === branch)
      .sort((a, b) => b.d.tier - a.d.tier) // tier 6 first (rendered top) down to tier 1 (bottom)
      .map(({ i }) => i)

  return (
    <div className="screen talents-screen">
      <div className="screen-header">
        <div className="screen-title">TALENT TREE</div>
        <div className="screen-subtitle">PERMANENT BONUSES FROM COMBAT XP</div>
      </div>

      <div className="talent-tree-summary">
        <LevelBadge level={t.level} xp={t.xp} xpToNextLevel={t.xpToNextLevel()} size="large" />
        <div className="talent-points-available">
          {t.unspentPoints} POINT{t.unspentPoints === 1 ? '' : 'S'} AVAILABLE
        </div>
      </div>

      {capstoneIndex >= 0 && (
        <div className={`talent-capstone-card ${capstoneUnlocked ? '' : 'is-locked'}`}>
          <TalentNode session={s} index={capstoneIndex} onToast={onToast} />
          {!capstoneUnlocked && <div className="talent-capstone-req">{talentUnlockLabel(defs, capstoneIndex)}</div>}
        </div>
      )}

      <div className="talent-tree-columns">
        {BRANCH_ORDER.map((branch) => {
          const indices = branchIndices(branch)
          return (
            <div key={branch} className="talent-branch-column">
              <div className="talent-branch-label" style={{ color: BRANCH_COLOR[branch] }}>
                {BRANCH_LABEL[branch]}
              </div>
              {indices.map((i, pos) => (
                <div key={i} className="talent-node-wrap">
                  <TalentNode session={s} index={i} onToast={onToast} />
                  {pos < indices.length - 1 && <div className={`talent-connector ${t.levelOf(indices[pos + 1]) > 0 ? 'is-lit' : ''}`} />}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
