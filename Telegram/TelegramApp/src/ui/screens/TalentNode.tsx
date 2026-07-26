// One node in the talent tree - compact (multiple stack per cluster panel, unlike ArtifactRow's
// single wide list) but the same interaction model: one tap = one level, 1 Talent Point, reusing
// the exact row-icon-pop flourish + haptic + purchase sound ArtifactRow already established.
// Gem Socket nodes use this same buy-a-level flow to unlock the slot itself (see TalentEffect.
// GemSocket's own comment); once unlocked, tapping it again opens SocketPickerSheet to choose
// which owned card fills it (see onOpenSocket).
import { useState, type CSSProperties } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { talentBonusAt, talentUnlockLabel, TalentEffect } from '../../game/config/TalentDefinition'
import { cardById } from '../../game/cards/generatedCards'
import { hapticAction, hapticTap } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { LockIcon, GemIcon } from '../icons'
import { CLUSTER_COLOR, clusterIcon } from './talentTreeMeta'

interface TalentNodeProps {
  session: GameSession
  index: number
  onToast: (text: string) => void
  /** Opens SocketPickerSheet for this node's id - only ever called for an already-unlocked gem
   *  node (buying the slot itself still goes through the normal Talent Point purchase below). */
  onOpenSocket?: (nodeId: string) => void
}

export function TalentNode({ session: s, index, onToast, onOpenSocket }: TalentNodeProps) {
  const t = s.talents
  const def = t.def(index)
  const lvl = t.levelOf(index)
  const unlocked = t.isUnlocked(index)
  const maxed = lvl >= def.maxLevel
  const isGem = def.effect === TalentEffect.GemSocket
  const pct = Math.round(talentBonusAt(def, lvl) * 100)
  const color = def.branch === 'nexus' ? '#F0E6FF' : CLUSTER_COLOR[def.branch]
  const [popKey, setPopKey] = useState(0)

  const socketed = isGem && lvl > 0 ? s.gems.cardAt(def.id) : undefined
  const socketedCard = socketed ? cardById(socketed.cardId) : undefined

  const handleTap = () => {
    if (!unlocked) {
      onToast(talentUnlockLabel(Array.from({ length: t.count }, (_, i) => t.def(i)), index).toUpperCase())
      return
    }
    if (maxed) {
      if (isGem) {
        hapticTap()
        onOpenSocket?.(def.id)
        return
      }
      onToast('ALREADY MAXED')
      return
    }
    if (s.buyTalentNode(index)) {
      hapticAction()
      audio.purchase()
      setPopKey((k) => k + 1)
      if (isGem) onToast('SOCKET UNLOCKED - TAP AGAIN TO SOCKET A CARD')
    } else {
      onToast('NOT ENOUGH TALENT POINTS')
    }
  }

  return (
    <button
      className={`talent-node ${def.branch === 'nexus' ? 'talent-node--capstone' : ''} ${!unlocked ? 'is-locked' : ''} ${maxed ? 'is-maxed' : ''} ${lvl > 0 ? 'is-owned' : ''} ${isGem ? 'talent-node--gem' : ''}`}
      onClick={handleTap}
      style={{ '--talent-color': color } as CSSProperties}
    >
      <div key={popKey} className="talent-node-icon row-icon-pop">
        {!unlocked ? <LockIcon /> : isGem ? <GemIcon filled={!!socketed} /> : clusterIcon(def.branch)}
      </div>
      <div className="talent-node-level">
        {lvl}/{def.maxLevel}
      </div>
      <div className="talent-node-name">{def.displayName}</div>
      {lvl > 0 && !isGem && <div className="talent-node-bonus">+{pct}%</div>}
      {isGem && lvl > 0 && <div className="talent-node-bonus talent-node-gem-fill">{socketedCard ? socketedCard.name : 'EMPTY'}</div>}
    </button>
  )
}
