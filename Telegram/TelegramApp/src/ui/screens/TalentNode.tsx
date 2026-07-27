// One node in the talent tree - the same interaction model as before: one tap = one level, 1
// Talent Point, reusing the row-icon-pop flourish + haptic + purchase sound ArtifactRow already
// established. Gem Socket nodes use this same buy-a-level flow to unlock the slot itself (see
// TalentEffect.GemSocket's own comment); once unlocked, tapping it again opens SocketPickerSheet
// to choose which owned card fills it (see onOpenSocket).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { talentBonusAt, talentUnlockLabel, TalentEffect, EFFECT_LABEL, BRANCH_COLOR, type TalentBranch } from '../../game/config/TalentDefinition'
import { cardById } from '../../game/cards/generatedCards'
import { RARITY_COLOR } from '../cards/cardTheme'
import { hapticAction, hapticTap } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { LockIcon, GemIcon } from '../icons'
import { branchIcon } from './talentTreeMeta'

/** How long the one-shot purchase flash (.talent-node--celebrate) plays before clearing itself -
 *  must match @keyframes talent-node-celebrate's duration in ui.css. */
const CELEBRATE_MS = 700

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

  const socketed = isGem && lvl > 0 ? s.gems.cardAt(def.id) : undefined
  const socketedCard = socketed ? cardById(socketed.cardId) : undefined

  // Combo talents bridge 2 branches, not owned by either - a distinct lavender, same idea as the
  // old single Grand Nexus. Regular nodes take their branch's own color. A filled Gem Socket
  // borrows its socketed card's own rarity color instead of a flat purple, so the glow/celebrate
  // treatment below reads as "this specific card", not just "a gem lives here".
  const color = def.branch === 'combo' ? '#F0E6FF' : isGem ? (socketedCard ? RARITY_COLOR[socketedCard.rarity] : '#D6A8FF') : BRANCH_COLOR[def.branch as TalentBranch]
  const [popKey, setPopKey] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(celebrateTimer.current), [])

  // "Tap this next" - unlocked, not maxed, and there's a point to spend. Gem Sockets read as
  // affordable only while the slot itself is still unpurchased; once bought, an empty slot gets
  // its own distinct "come fill me" treatment (.talent-node--gem, not this one).
  const affordable = unlocked && !maxed && t.unspentPoints > 0

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
      setCelebrate(true)
      clearTimeout(celebrateTimer.current)
      celebrateTimer.current = setTimeout(() => setCelebrate(false), CELEBRATE_MS)
      if (isGem) onToast('SOCKET UNLOCKED - TAP AGAIN TO SOCKET A CARD')
    } else {
      onToast('NOT ENOUGH TALENT POINTS')
    }
  }

  return (
    <button
      className={`talent-node ${def.isCapstone ? 'talent-node--capstone' : ''} ${!unlocked ? 'is-locked' : ''} ${maxed ? 'is-maxed' : ''} ${lvl > 0 ? 'is-owned' : ''} ${isGem ? 'talent-node--gem' : ''} ${isGem && socketed ? 'talent-node--gem-filled' : ''} ${affordable ? 'talent-node--affordable' : ''} ${celebrate ? 'talent-node--celebrate' : ''}`}
      onClick={handleTap}
      style={{ '--talent-color': color } as CSSProperties}
    >
      <div key={popKey} className="talent-node-icon row-icon-pop">
        {!unlocked ? <LockIcon /> : isGem ? <GemIcon filled={!!socketed} /> : branchIcon(def.branch)}
      </div>
      <div className="talent-node-level">
        {lvl}/{def.maxLevel}
      </div>
      <div className="talent-node-name">{EFFECT_LABEL[def.effect]}</div>
      {lvl > 0 && !isGem && <div className="talent-node-bonus">+{pct}%</div>}
      {isGem && lvl > 0 && <div className="talent-node-bonus talent-node-gem-fill">{socketedCard ? socketedCard.name : 'EMPTY'}</div>}
    </button>
  )
}
