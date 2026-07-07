// Ported from GamePhone.dc.html's Prestige screen.
import type { GameSession } from '../../game/gameplay/GameSession'

interface PrestigeScreenProps {
  session: GameSession
  onPrestigeRequested: () => void
}

export function PrestigeScreen({ session: s, onPrestigeRequested }: PrestigeScreenProps) {
  const gained = s.previewRelics()

  return (
    <div className="screen prestige-screen">
      <div className="screen-header">
        <div className="screen-title">PRESTIGE</div>
        <div className="prestige-intro">Reset your run for permanent Relic power.</div>
      </div>

      <div className="prestige-hero">
        <div className="prestige-hero-label">RELICS READY TO COLLECT</div>
        <div className="prestige-gained">+{gained.toShortString()}</div>
        <div className="prestige-current">You currently hold {s.prestige.relics.balance.toShortString()} Relics</div>
      </div>

      <div className="prestige-stats">
        <div className="prestige-stat-box">
          <div className="prestige-stat-label">SECTOR REACHED</div>
          <div className="prestige-stat-value">{s.stage.highestStage}</div>
        </div>
        <div className="prestige-stat-box">
          <div className="prestige-stat-label">STARDUST EARNED</div>
          <div className="prestige-stat-value">{s.wallet.balance.toShortString()}</div>
        </div>
      </div>

      <div className="resets-keeps-row">
        <div className="resets-box">
          <div className="resets-keeps-title">RESETS</div>
          <div className="resets-keeps-body">
            Sector Progress
            <br />
            Stardust Balance
            <br />
            Ship &amp; Tap Levels
          </div>
        </div>
        <div className="keeps-box">
          <div className="resets-keeps-title">KEEPS</div>
          <div className="resets-keeps-body">
            Artifacts &amp; Relics
            <br />
            Ship Ownership
            <br />
            Mission Progress
          </div>
        </div>
      </div>

      <button className="prestige-gradient-btn" disabled={!s.canPrestige()} onClick={onPrestigeRequested}>
        PRESTIGE NOW
      </button>
    </div>
  )
}
