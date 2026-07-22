// Milestone achievements: display/recognition only (no reward), computed fresh from existing
// session stats + owned cards - no network call, no new persisted state. Mirrors
// MissionsSheet.tsx's "read straight off live data" style, flattened since 20 rows doesn't
// need the missions sheet's active-chain indirection.
import type { GameSession } from '../../game/gameplay/GameSession'
import type { OwnedCard } from '../../game/cards/cardsApi'
import { ACHIEVEMENTS, CATEGORY_LABEL, type AchievementCategory } from '../../game/achievements/AchievementDefinition'
import { buildAchievementInput, isUnlocked, progress01, valueFor } from '../../game/achievements/evaluateAchievements'
import { Sheet } from '../Sheet'

interface AchievementsSheetProps {
  session: GameSession
  ownedCards: OwnedCard[]
  open: boolean
  onClose: () => void
}

const CATEGORY_ORDER: AchievementCategory[] = ['planetsDestroyed', 'bossesDefeated', 'distinctBosses', 'deepestStage', 'prestigeCount', 'cardsCollected', 'dailyStreak']

export function AchievementsSheet({ session, ownedCards, open, onClose }: AchievementsSheetProps) {
  // Recomputed on every open, not memoized across renders - 20 cheap comparisons is not worth
  // tracking a dependency array for, and this sheet is closed most of the time anyway.
  const input = buildAchievementInput(session, ownedCards)
  const unlockedCount = ACHIEVEMENTS.filter((def) => isUnlocked(def, input)).length

  return (
    <Sheet open={open} onClose={onClose} title={`ACHIEVEMENTS · ${unlockedCount}/${ACHIEVEMENTS.length}`}>
      <div className="achievements-list">
        {CATEGORY_ORDER.map((category) => (
          <div key={category}>
            <div className="achievement-category-header">{CATEGORY_LABEL[category]}</div>
            {ACHIEVEMENTS.filter((def) => def.category === category).map((def) => {
              const unlocked = isUnlocked(def, input)
              const pct = progress01(def, input) * 100
              return (
                <div key={def.id} className={`achievement-row ${unlocked ? '' : 'achievement-row--locked'}`}>
                  {def.tier && <div className={`achievement-tier-badge achievement-tier-badge--${def.tier}`}>{def.tier[0].toUpperCase()}</div>}
                  <div className="achievement-body">
                    <div className="achievement-name">{def.name}</div>
                    <div className="achievement-description">{def.description}</div>
                    <div className="mission-progress-bar">
                      <div className="mission-progress-fill" style={{ width: `${pct}%`, background: unlocked ? 'var(--palette-success)' : 'var(--palette-cyan)' }} />
                    </div>
                    <div className="achievement-progress-label">
                      {Math.min(valueFor(def, input), def.threshold).toLocaleString()}/{def.threshold.toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
