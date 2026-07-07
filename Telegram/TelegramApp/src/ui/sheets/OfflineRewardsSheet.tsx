// Ported from GamePhone.dc.html's Offline Rewards modal.
import type { BigNumber } from '../../game/core/BigNumber'
import type { OfflineReport } from '../../game/useGameSession'
import { Sheet } from '../Sheet'
import { GoldIcon } from '../icons'

interface OfflineRewardsSheetProps {
  offline: OfflineReport | null
  open: boolean
  onClose: () => void
  onCollected: (gold: BigNumber) => void
}

export function OfflineRewardsSheet({ offline, open, onClose, onCollected }: OfflineRewardsSheetProps) {
  if (!offline) return null

  const h = Math.floor(offline.seconds / 3600)
  const m = Math.floor((offline.seconds % 3600) / 60)
  const body = `Your fleet held the line for ${h > 0 ? `${h}h ` : ''}${m}m while you were away.`

  return (
    <Sheet open={open} onClose={onClose} title="OFFLINE REWARDS">
      <div className="offline-body-wrap">
        <div className="offline-icon-circle">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M20 12.5A8.5 8.5 0 1111.5 4a7 7 0 008.5 8.5z" fill="#C7CCDC" />
          </svg>
        </div>
        <div className="offline-headline">WELCOME BACK, COMMANDER</div>
        <div className="offline-body">{body}</div>
        <div className="offline-gold-pill">
          <GoldIcon size={15} />
          <span>+{offline.gold.toShortString()}</span>
        </div>
        <button
          className="offline-collect-button"
          onClick={() => {
            onCollected(offline.gold)
            onClose()
          }}
        >
          COLLECT
        </button>
      </div>
    </Sheet>
  )
}
