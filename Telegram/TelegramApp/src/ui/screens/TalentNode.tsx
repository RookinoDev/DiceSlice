// One node in the talent tree - compact (6 stack per branch column, unlike ArtifactRow's single
// wide list) but the same interaction model: one tap = one level, 1 Talent Point, reusing the
// exact row-icon-pop flourish + haptic + purchase sound ArtifactRow already established.
import { useState, type CSSProperties } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { talentBonusAt, talentUnlockLabel } from '../../game/config/TalentDefinition'
import { hapticAction } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { LockIcon } from '../icons'
import { BRANCH_COLOR, branchIcon } from './talentTreeMeta'

interface TalentNodeProps {
  session: GameSession
  index: number
  onToast: (text: string) => void
}

export function TalentNode({ session: s, index, onToast }: TalentNodeProps) {
  const t = s.talents
  const def = t.def(index)
  const lvl = t.levelOf(index)
  const unlocked = t.isUnlocked(index)
  const maxed = lvl >= def.maxLevel
  const pct = Math.round(talentBonusAt(def, lvl) * 100)
  const color = def.branch === 'capstone' ? '#F0E6FF' : BRANCH_COLOR[def.branch]
  const [popKey, setPopKey] = useState(0)

  const handleTap = () => {
    if (!unlocked) {
      onToast(talentUnlockLabel(Array.from({ length: t.count }, (_, i) => t.def(i)), index).toUpperCase())
      return
    }
    if (maxed) {
      onToast('ALREADY MAXED')
      return
    }
    if (s.buyTalentNode(index)) {
      hapticAction()
      audio.purchase()
      setPopKey((k) => k + 1)
    } else {
      onToast('NOT ENOUGH TALENT POINTS')
    }
  }

  return (
    <button
      className={`talent-node ${def.branch === 'capstone' ? 'talent-node--capstone' : ''} ${!unlocked ? 'is-locked' : ''} ${maxed ? 'is-maxed' : ''} ${lvl > 0 ? 'is-owned' : ''}`}
      onClick={handleTap}
      style={{ '--talent-color': color } as CSSProperties}
    >
      <div key={popKey} className="talent-node-icon row-icon-pop">
        {unlocked ? branchIcon(def.branch) : <LockIcon />}
      </div>
      <div className="talent-node-level">
        {lvl}/{def.maxLevel}
      </div>
      <div className="talent-node-name">{def.displayName}</div>
      {lvl > 0 && <div className="talent-node-bonus">+{pct}%</div>}
    </button>
  )
}
