// Ported from GamePhone.dc.html's Fleet Roster row. Our real ShipService has no "locked"
// concept (any ship is buyable any time with enough Stardust) and no persistent "isNew" flag
// (that moment is covered by the Ship Unlock celebration overlay instead) - so those two
// design states are intentionally not reproduced here, only owned/affordable.
import { useState } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { hapticAction } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { shipTierVisualForIndex } from '../shipTierVisuals'
import { BigNumber } from '../../game/core/BigNumber'

interface FleetRowProps {
  session: GameSession
  index: number
  onToast: (text: string) => void
}

export function FleetRow({ session: s, index, onToast }: FleetRowProps) {
  const ships = s.ships
  const def = ships.def(index)
  const owned = ships.isOwned(index)
  const afford = s.wallet.canAfford(ships.nextCost(index))
  const tier = shipTierVisualForIndex(index)
  const [popKey, setPopKey] = useState(0)

  return (
    <div className="fleet-row">
      <div key={popKey} className="row-icon-wrap row-icon-pop">
        <div className="row-icon-shape" style={{ clipPath: tier.clipPath, background: tier.color }} />
      </div>
      <div className="row-info">
        <div className="row-name">{def.shipName}</div>
        <div className="row-class">
          {tier.tierLabel.toUpperCase()}
          {owned ? ` · LV.${ships.levelOf(index)}` : ''}
        </div>
        {/* Was "DPS/s" - DPS already means "per second", the extra unit was a redundant typo. */}
        <div className="row-detail accent">{owned ? `${ships.shipDps(index).toShortString()} DPS` : 'Ready to deploy'}</div>
      </div>
      <button
        className={`row-action ${afford ? 'affordable' : ''}`}
        onClick={() => {
          if (s.buyShip(index)) {
            hapticAction()
            audio.purchase()
            setPopKey((k) => k + 1)
          } else onToast('NOT ENOUGH STARDUST')
        }}
      >
        <div className="row-action-label">{owned ? 'UPGRADE' : 'BUY'}</div>
        {/* User-requested: show what buying/upgrading actually gets you, not just what it
            costs - the DPS number already shown above only ever reflected the CURRENT level. */}
        <div className="row-action-dps">+{ships.nextLevelDps(index).sub(owned ? ships.shipDps(index) : BigNumber.Zero).toShortString()} DPS</div>
        <div className="row-action-cost">{ships.nextCost(index).toShortString()} G</div>
      </button>
    </div>
  )
}
