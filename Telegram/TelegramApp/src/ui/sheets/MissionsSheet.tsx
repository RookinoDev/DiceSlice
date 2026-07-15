// Ported from GamePhone.dc.html's Missions modal.
import type { GameSession } from '../../game/gameplay/GameSession'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction } from '../../telegram'
import { Sheet } from '../Sheet'

function formatProgress(current: number, target: number): string {
  const c = Math.min(current, target)
  return `${Math.round(c).toLocaleString()}/${Math.round(target).toLocaleString()}`
}

interface MissionsSheetProps {
  session: GameSession
  open: boolean
  onClose: () => void
  onClaimed: () => void
}

export function MissionsSheet({ session: s, open, onClose, onClaimed }: MissionsSheetProps) {
  const m = s.missions
  // Sprint 5 (#10): 180 generated missions (6 templates x 30 levels) share one running counter
  // per template - only the lowest-level unclaimed mission of each template is the "active" one
  // to work toward, the rest of that chain is implicit until claimed in order.
  const active = m.activeIndices()

  return (
    <Sheet open={open} onClose={onClose} title="MISSIONS">
      <div className="missions-list">
        {active.map((i) => {
          const def = m.def(i)
          const complete = m.isComplete(i)
          const claimed = m.isClaimed(i)
          const pct = m.progress01(i) * 100
          const reward = m.rewardFor(i, s.oneKillGold)
          return (
            <div key={i} className="mission-row">
              <div className="mission-name">{def.displayName}</div>
              <div className="mission-progress-bar">
                <div
                  className="mission-progress-fill"
                  style={{ width: `${pct}%`, background: claimed ? 'var(--palette-success)' : complete ? 'var(--palette-gold)' : 'var(--palette-cyan)' }}
                />
              </div>
              <div className="mission-footer-row">
                <div className="mission-progress-label">
                  {formatProgress(m.progressOf(i).toNumber(), def.target)} · {reward.toShortString()} Stardust
                </div>
                <button
                  className={`mission-claim ${complete && !claimed ? 'claimable' : ''}`}
                  disabled={!complete || claimed}
                  onClick={() => {
                    if (s.claimMission(i)) {
                      audio.prestige()
                      hapticAction()
                      onClaimed()
                    }
                  }}
                >
                  {claimed ? 'CLAIMED' : complete ? 'CLAIM' : 'IN PROGRESS'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
