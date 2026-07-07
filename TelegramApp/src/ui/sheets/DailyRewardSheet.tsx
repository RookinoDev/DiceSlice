// Ported from GamePhone.dc.html's Daily Reward modal.
import type { GameSession, DailyPreview } from '../../game/gameplay/GameSession'
import { nowUnixSeconds } from '../../game/persistence/localStorageSave'
import { Sheet } from '../Sheet'
import { CheckIcon, LockIcon } from '../icons'

interface DailyRewardSheetProps {
  session: GameSession
  open: boolean
  onClose: () => void
  onClaimed: (result: DailyPreview) => void
}

export function DailyRewardSheet({ session: s, open, onClose, onClaimed }: DailyRewardSheetProps) {
  const now = nowUnixSeconds()
  const preview = s.previewDaily(now)
  const todayIndex = preview.day - 1

  const handleClaim = () => {
    const result = s.claimDaily(now)
    if (result.canClaim) onClaimed(result)
  }

  return (
    <Sheet open={open} onClose={onClose} title="DAILY REWARD">
      <div className="daily-grid">
        {Array.from({ length: 7 }, (_, i) => {
          const dayNum = i + 1
          const isPast = i < todayIndex || (i === todayIndex && !preview.canClaim)
          const isToday = i === todayIndex && preview.canClaim
          const isFuture = i > todayIndex
          const relicDay = s.dailyGrantsRelicOnDay(dayNum)
          const gold = s.dailyGoldForDay(dayNum)

          return (
            <div key={i} className={`daily-cell ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}>
              <div className="daily-cell-day">DAY {dayNum}</div>
              <div className="daily-cell-glyph">
                {isPast && <CheckIcon color="#3ADC84" size={14} />}
                {isFuture && <LockIcon color="#4A5170" size={13} />}
              </div>
              <div className="daily-cell-reward">{relicDay ? `${gold.toShortString()} +Relic` : gold.toShortString()}</div>
            </div>
          )
        })}
      </div>
      <button className={`daily-claim-button ${preview.canClaim ? 'claimable' : ''}`} disabled={!preview.canClaim} onClick={handleClaim}>
        {preview.canClaim ? `CLAIM DAY ${preview.day} REWARD` : 'COME BACK TOMORROW'}
      </button>
    </Sheet>
  )
}
