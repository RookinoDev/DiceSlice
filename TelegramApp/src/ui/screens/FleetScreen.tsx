// Ported from GamePhone.dc.html's Fleet Roster screen.
import type { GameSession } from '../../game/gameplay/GameSession'
import { FleetRow } from './FleetRow'

interface FleetScreenProps {
  session: GameSession
  onToast: (text: string) => void
}

export function FleetScreen({ session: s, onToast }: FleetScreenProps) {
  let unlocked = 0
  for (let i = 0; i < s.ships.count; i++) if (s.ships.isOwned(i)) unlocked++

  return (
    <div className="screen fleet-screen">
      <div className="screen-header">
        <div className="screen-title">FLEET</div>
        <div className="screen-subtitle">
          {unlocked} / {s.ships.count} DEPLOYED
        </div>
      </div>
      <div className="fleet-list">
        {Array.from({ length: s.ships.count }, (_, i) => (
          <FleetRow key={i} session={s} index={i} onToast={onToast} />
        ))}
      </div>
    </div>
  )
}
