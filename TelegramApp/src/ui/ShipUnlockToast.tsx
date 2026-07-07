// Ported from GamePhone.dc.html's New Ship Unlocked celebration - a full-bleed overlay
// (not a bottom sheet), one of only two full celebrations in the feedback hierarchy
// alongside Prestige success.
import type { ShipDefinition } from '../game/config/ShipDefinition'
import { shipTierVisualForIndex } from './shipTierVisuals'

export interface ShipUnlockInfo {
  def: ShipDefinition
  shipIndex: number
}

interface ShipUnlockToastProps {
  unlock: ShipUnlockInfo | null
  onClose: () => void
  onViewFleet: () => void
}

export function ShipUnlockToast({ unlock, onClose, onViewFleet }: ShipUnlockToastProps) {
  if (!unlock) return null
  const { def, shipIndex } = unlock
  const tier = shipTierVisualForIndex(shipIndex)
  const classLabel = def.className ? `${def.className.toUpperCase()} · ${tier.tierLabel.toUpperCase()}` : tier.tierLabel.toUpperCase()

  return (
    <div className="ship-unlock-overlay">
      <div className="ship-unlock-eyebrow">NEW SHIP UNLOCKED</div>
      <div className="ship-unlock-icon-wrap">
        <div className="ship-unlock-icon-shape" style={{ clipPath: tier.clipPath, background: '#43DDEE' }} />
      </div>
      <div className="ship-unlock-name">{def.shipName}</div>
      <div className="ship-unlock-class">{classLabel}</div>
      <div className="ship-unlock-quote">&ldquo;The {def.shipName} answers your call, Commander.&rdquo;</div>
      <div className="ship-unlock-actions">
        <button className="ship-unlock-dismiss" onClick={onClose}>
          DISMISS
        </button>
        <button
          className="ship-unlock-view-fleet"
          onClick={() => {
            onClose()
            onViewFleet()
          }}
        >
          VIEW FLEET
        </button>
      </div>
    </div>
  )
}
