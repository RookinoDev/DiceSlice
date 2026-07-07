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

  return (
    <Sheet open={open} onClose={onClose} title="MISSIONS">
      <div className="missions-list">
        {Array.from({ length: m.count }, (_, i) => {
          const def = m.def(i)
          const complete = m.isComplete(i)
          const claimed = m.isClaimed(i)
          const pct = m.progress01(i) * 100
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
                  {formatProgress(m.progressOf(i).toNumber(), def.target)} · {def.goldReward.toLocaleString()} Stardust
                </div>
                <button
                  className={`mission-claim ${complete && !claimed ? 'claimable' : ''}`}
                  disabled={!complete || claimed}
                  onClick={() => {
                    if (m.claim(i)) {
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
