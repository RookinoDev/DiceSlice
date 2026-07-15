// Ported from GamePhone.dc.html's Daily Reward modal.
import { useEffect, useRef } from 'react'
import type { GameSession, DailyPreview } from '../../game/gameplay/GameSession'
import { nowUnixSeconds } from '../../game/persistence/localStorageSave'
import { CYCLE_LENGTH } from '../../game/economy/DailyRewardTable'
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
  const gridRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)

  // #11 fix: the grid grew from 7 to 30 cells and now scrolls horizontally - without this,
  // opening the sheet mid-cycle could land on a screen with no visible cue where "today" is.
  useEffect(() => {
    if (open) todayRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [open])

  const handleClaim = () => {
    const result = s.claimDaily(now)
    if (result.canClaim) onClaimed(result)
  }

  return (
    <Sheet open={open} onClose={onClose} title="DAILY REWARD">
      <div className="daily-grid" ref={gridRef}>
        {Array.from({ length: CYCLE_LENGTH }, (_, i) => {
          const dayNum = i + 1
          const isPast = i < todayIndex || (i === todayIndex && !preview.canClaim)
          const isToday = i === todayIndex && preview.canClaim
          const isFuture = i > todayIndex
          const relicDay = s.dailyGrantsRelicOnDay(dayNum)
          const packTier = s.dailyGrantsPackOnDay(dayNum)
          const gold = s.dailyGoldForDay(dayNum)

          return (
            <div key={i} ref={isToday ? todayRef : undefined} className={`daily-cell ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}>
              <div className="daily-cell-day">DAY {dayNum}</div>
              <div className="daily-cell-glyph">
                {isPast && <CheckIcon color="#3ADC84" size={14} />}
                {isFuture && <LockIcon color="#4A5170" size={13} />}
              </div>
              <div className="daily-cell-reward">{gold.toShortString()}</div>
              {(relicDay || packTier) && (
                <div className="daily-cell-bonus">
                  {relicDay ? '+RELIC' : null}
                  {packTier ? '+PACK' : null}
                </div>
              )}
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
