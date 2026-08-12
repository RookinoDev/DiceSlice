// Long-press on Eternal Drive: lists every random passive perk it's ever granted (see
// PassivePerk.ts + TalentService.grantedPerks). Read-only - nothing to buy or change here.
import type { GameSession } from '../../game/gameplay/GameSession'
import { grantedPerkLabel } from '../../game/config/PassivePerk'
import { Sheet } from '../Sheet'

interface PassivePerksSheetProps {
  session: GameSession
  open: boolean
  onClose: () => void
}

export function PassivePerksSheet({ session: s, open, onClose }: PassivePerksSheetProps) {
  const perks = s.talents.grantedPerks

  return (
    <Sheet open={open} onClose={onClose} title={`ETERNAL DRIVE · ${perks.length} PERK${perks.length === 1 ? '' : 'S'}`}>
      {perks.length === 0 ? (
        <div className="cards-empty">No perks granted yet - spend a point on Eternal Drive to roll the first one.</div>
      ) : (
        <div className="news-list">
          {perks
            .map((perk, i) => ({ perk, i }))
            .reverse()
            .map(({ perk, i }) => (
              <div key={i} className="news-entry">
                <div className="news-entry-date">PERK #{i + 1}</div>
                <div className="news-entry-title">{grantedPerkLabel(perk)}</div>
              </div>
            ))}
        </div>
      )}
    </Sheet>
  )
}
