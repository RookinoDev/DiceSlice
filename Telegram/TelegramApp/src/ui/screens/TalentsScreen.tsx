// The talent tree: 6 clusters, each its own fork-merge-fork-merge lattice (see
// TalentClusterPanel.tsx's SVG connector rendering and TalentDefinition.ts's buildCluster
// diagram), stacked vertically down one scrollable screen and converging on 1 Grand Nexus card
// at the top. Stacked rather than side-by-side (unlike the original 4-branch layout) because
// each cluster is 3 columns wide internally now - 6 of those side by side would never fit a
// phone screen, but the screen already scrolls vertically for free.
import type { GameSession } from '../../game/gameplay/GameSession'
import { CLUSTER_ORDER, talentUnlockLabel, type TalentCluster } from '../../game/config/TalentDefinition'
import { LevelBadge } from '../LevelBadge'
import { TalentNode } from './TalentNode'
import { TalentClusterPanel } from './TalentClusterPanel'
import { CLUSTER_LABEL, CLUSTER_COLOR } from './talentTreeMeta'

interface TalentsScreenProps {
  session: GameSession
  onToast: (text: string) => void
}

export function TalentsScreen({ session: s, onToast }: TalentsScreenProps) {
  const t = s.talents
  const defs = Array.from({ length: t.count }, (_, i) => t.def(i))
  const nexusIndex = defs.findIndex((d) => d.branch === 'nexus')
  const nexusUnlocked = nexusIndex >= 0 && t.isUnlocked(nexusIndex)

  const clusterIndices = (cluster: TalentCluster): number[] => defs.map((_, i) => i).filter((i) => defs[i].branch === cluster)

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

      {nexusIndex >= 0 && (
        <div className={`talent-capstone-card ${nexusUnlocked ? '' : 'is-locked'}`}>
          <TalentNode session={s} index={nexusIndex} onToast={onToast} />
          {!nexusUnlocked && <div className="talent-capstone-req">{talentUnlockLabel(defs, nexusIndex)}</div>}
        </div>
      )}

      <div className="talent-tree-clusters">
        {CLUSTER_ORDER.map((cluster) => (
          <div key={cluster} className="talent-cluster-row">
            <div className="talent-cluster-label" style={{ color: CLUSTER_COLOR[cluster] }}>
              {CLUSTER_LABEL[cluster]}
            </div>
            <TalentClusterPanel session={s} nodeIndices={clusterIndices(cluster)} onToast={onToast} />
          </div>
        ))}
      </div>
    </div>
  )
}
