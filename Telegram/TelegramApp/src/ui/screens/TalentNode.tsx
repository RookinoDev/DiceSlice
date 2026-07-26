// One node in the talent tree - compact (multiple stack per cluster panel, unlike ArtifactRow's
// single wide list) but the same interaction model: one tap = one level, 1 Talent Point, reusing
// the exact row-icon-pop flourish + haptic + purchase sound ArtifactRow already established.
// Gem Socket nodes use this same buy-a-level flow to unlock the slot itself (see TalentEffect.
// GemSocket's own comment) - which card actually sits in an unlocked slot is a separate concern,
// wired up once GemSocketService exists.
import { useState, type CSSProperties } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { talentBonusAt, talentUnlockLabel, TalentEffect } from '../../game/config/TalentDefinition'
import { hapticAction } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { LockIcon } from '../icons'
import { CLUSTER_COLOR, clusterIcon } from './talentTreeMeta'

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
  const isGem = def.effect === TalentEffect.GemSocket
  const pct = Math.round(talentBonusAt(def, lvl) * 100)
  const color = def.branch === 'nexus' ? '#F0E6FF' : CLUSTER_COLOR[def.branch]
  const [popKey, setPopKey] = useState(0)

  const handleTap = () => {
    if (!unlocked) {
      onToast(talentUnlockLabel(Array.from({ length: t.count }, (_, i) => t.def(i)), index).toUpperCase())
      return
    }
    if (maxed) {
      onToast(isGem ? 'SOCKET UNLOCKED' : 'ALREADY MAXED')
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
      className={`talent-node ${def.branch === 'nexus' ? 'talent-node--capstone' : ''} ${!unlocked ? 'is-locked' : ''} ${maxed ? 'is-maxed' : ''} ${lvl > 0 ? 'is-owned' : ''}`}
      onClick={handleTap}
      style={{ '--talent-color': color } as CSSProperties}
    >
      <div key={popKey} className="talent-node-icon row-icon-pop">
        {unlocked ? clusterIcon(def.branch) : <LockIcon />}
      </div>
      <div className="talent-node-level">
        {lvl}/{def.maxLevel}
      </div>
      <div className="talent-node-name">{def.displayName}</div>
      {lvl > 0 && !isGem && <div className="talent-node-bonus">+{pct}%</div>}
    </button>
  )
}
