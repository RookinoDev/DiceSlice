// Ported from GamePhone.dc.html's Confirm Prestige modal. Renders two states inside the same
// sheet - confirm, then (in place) the success celebration - matching the design's own
// isModalPrestigeConfirm / prestigeDone state machine rather than a separate full-bleed overlay.
import { useEffect, useState } from 'react'
import { BigNumber } from '../../game/core/BigNumber'
import type { GameSession } from '../../game/gameplay/GameSession'
import { Sheet } from '../Sheet'
import { CheckIcon } from '../icons'

interface PrestigeConfirmSheetProps {
  session: GameSession
  open: boolean
  onClose: () => void
  onPrestiged: (relicsGained: BigNumber) => void
  onToast: (text: string) => void
}

export function PrestigeConfirmSheet({ session: s, open, onClose, onPrestiged, onToast }: PrestigeConfirmSheetProps) {
  const [gainedDone, setGainedDone] = useState<BigNumber | null>(null)

  // This component stays mounted across open/close cycles (only the Sheet's own subtree
  // unmounts) - reset back to the confirm step each time it reopens.
  useEffect(() => {
    if (open) setGainedDone(null)
  }, [open])

  // Fires when the success view actually renders (not on the Confirm click itself), so the
  // celebration audio/haptic/shake land with the "RELICS COLLECTED" screen, not a beat early.
  useEffect(() => {
    if (gainedDone) onPrestiged(gainedDone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gainedDone])

  const handleConfirm = () => {
    // A run should never reset mid-buff - Overdrive/Battle Cry/Drone Swarm/Midas Beam would
    // otherwise carry a "still active" timer into a freshly reset run that no longer matches
    // what's on screen. Block the action itself here (not the whole Prestige entry point,
    // which stays reachable) and tell the player why.
    if (s.skills.hasAnyActive()) {
      onToast('POWERUPS ACTIVE — WAIT TO ASCEND')
      return
    }
    const gained = s.doPrestige()
    if (gained.gt(BigNumber.Zero)) {
      setGainedDone(gained)
    } else {
      onClose()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="CONFIRM PRESTIGE">
      {gainedDone ? (
        <div className="prestige-success">
          <div className="prestige-success-badge">
            <CheckIcon color="#08130b" size={30} />
          </div>
          <div className="prestige-success-title">RELICS COLLECTED</div>
          <div className="prestige-success-amount">+{gainedDone.toShortString()}</div>
          <div className="prestige-success-body">Your fleet resets to Sector 1 with permanently stronger Relic bonuses.</div>
          <button className="prestige-success-continue" onClick={onClose}>
            CONTINUE
          </button>
        </div>
      ) : (
        <div className="prestige-confirm-body">
          <div className="prestige-confirm-amount">+{s.previewRelics().toShortString()} RELICS</div>
          <div className="prestige-confirm-warning">This will reset your current run in exchange for permanent power. Confirm to continue.</div>
          <div className="resets-keeps-row">
            <div className="resets-box">
              <div className="resets-keeps-title">RESETS</div>
              <div className="resets-keeps-body">Sector · Stardust · Levels</div>
            </div>
            <div className="keeps-box">
              <div className="resets-keeps-title">KEEPS</div>
              <div className="resets-keeps-body">Relics · Artifacts · Ships</div>
            </div>
          </div>
          <div className="sheet-actions">
            <button className="sheet-button-secondary" onClick={onClose}>
              CANCEL
            </button>
            <button className="sheet-button-primary" onClick={handleConfirm}>
              CONFIRM
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
