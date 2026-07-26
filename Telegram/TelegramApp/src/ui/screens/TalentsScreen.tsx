// The talent tree: one unified shape (see TalentDefinition.ts's buildDefaultTalents diagram) -
// a shared trunk at the bottom climbing through a first fork into 4 straight branches at the
// top, all rendered as a single SVG panel (TalentClusterPanel.tsx already computes edges/
// positions generically from whatever node indices it's given - feeding it every node at once
// turns it into one continuous tree instead of the old 6-separate-panels layout).
import type { GameSession } from '../../game/gameplay/GameSession'
import { CLUSTER_ORDER } from '../../game/config/TalentDefinition'
import { LevelBadge } from '../LevelBadge'
import { TalentClusterPanel } from './TalentClusterPanel'
import { CLUSTER_LABEL, CLUSTER_COLOR } from './talentTreeMeta'

interface TalentsScreenProps {
  session: GameSession
  onToast: (text: string) => void
  onOpenSocket?: (nodeId: string) => void
}

export function TalentsScreen({ session: s, onToast, onOpenSocket }: TalentsScreenProps) {
  const t = s.talents
  const allIndices = Array.from({ length: t.count }, (_, i) => i)

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

      <div className="talent-tree-legend">
        {CLUSTER_ORDER.map((cluster) => (
          <div key={cluster} className="talent-tree-legend-item" style={{ color: CLUSTER_COLOR[cluster] }}>
            {CLUSTER_LABEL[cluster]}
          </div>
        ))}
      </div>

      <TalentClusterPanel session={s} nodeIndices={allIndices} onToast={onToast} onOpenSocket={onOpenSocket} />
    </div>
  )
}
