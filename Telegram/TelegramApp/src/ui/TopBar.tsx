// Ported from GamePhone.dc.html's top bar + upper status row.
import { useEffect, useRef } from 'react'
import { BigNumber } from '../game/core/BigNumber'
import type { GameSession } from '../game/gameplay/GameSession'
import { audio } from '../game/audio/AudioManager'
import { useCountUp } from './useCountUp'
import { LevelBadge } from './LevelBadge'
import { registerLandmark } from './combatFx/landmarks'
import { SettingsIcon, ProfileIcon, MissionsBellIcon, AchievementsIcon, LeaderboardIcon, GoldIcon, FleetDpsIcon, RelicIcon } from './icons'

interface TopBarProps {
  session: GameSession
  onSettingsClick: () => void
  onProfileClick: () => void
  onNotificationClick: () => void
  onAchievementsClick: () => void
  onLeaderboardClick: () => void
  onTalentsClick: () => void
}

export function TopBar({ session: s, onSettingsClick, onProfileClick, onNotificationClick, onAchievementsClick, onLeaderboardClick, onTalentsClick }: TopBarProps) {
  const hasRelics = s.prestige.relics.balance.gt(BigNumber.Zero) || s.canPrestige()

  let anyMissionClaimable = false
  for (let i = 0; i < s.missions.count; i++) {
    if (s.missions.isComplete(i) && !s.missions.isClaimed(i)) {
      anyMissionClaimable = true
      break
    }
  }
  const displayedGold = useCountUp(s.wallet.balance)
  const displayedRelics = useCountUp(s.prestige.relics.balance)
  const goldPillRef = useRef<HTMLDivElement>(null)

  // Registers where the gold pill is on screen so Resource Vacuum particles (GameShell) know
  // where to fly to, without prop-drilling a ref through the whole shell.
  useEffect(() => {
    registerLandmark('gold-pill', goldPillRef.current)
    return () => registerLandmark('gold-pill', null)
  }, [])

  return (
    <div className="topbar-wrap">
      <div className="topbar-row">
        <div className="topbar-icon-group">
          <button
            className="topbar-icon-btn"
            onClick={() => {
              audio.click()
              onProfileClick()
            }}
            aria-label="Profile"
          >
            <ProfileIcon />
          </button>
          <LevelBadge
            level={s.talents.level}
            xp={s.talents.xp}
            xpToNextLevel={s.talents.xpToNextLevel()}
            onClick={() => {
              audio.click()
              onTalentsClick()
            }}
          />
        </div>

        <div className="topbar-icon-group">
          <button
            className="topbar-icon-btn"
            // See TutorialSteps.ts's 'missions-intro' step.
            ref={(el) => registerLandmark('topbar-missions', el)}
            onClick={() => {
              audio.click()
              onNotificationClick()
            }}
            aria-label="Missions"
          >
            <MissionsBellIcon />
            {anyMissionClaimable && <span className="dot dot-notification" />}
          </button>
          <button
            className="topbar-icon-btn"
            // See TutorialSteps.ts's 'achievements-intro' step.
            ref={(el) => registerLandmark('topbar-achievements', el)}
            onClick={() => {
              audio.click()
              onAchievementsClick()
            }}
            aria-label="Achievements"
          >
            <AchievementsIcon />
          </button>
          <button
            className="topbar-icon-btn"
            // See TutorialSteps.ts's 'leaderboard-intro' step.
            ref={(el) => registerLandmark('topbar-leaderboard', el)}
            onClick={() => {
              audio.click()
              onLeaderboardClick()
            }}
            aria-label="Leaderboard"
          >
            <LeaderboardIcon />
          </button>
          <button
            className="topbar-icon-btn"
            onClick={() => {
              audio.click()
              onSettingsClick()
            }}
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div className="topbar-status-row">
        <div ref={goldPillRef} className="status-pill status-pill-gold">
          <GoldIcon />
          <span>{displayedGold.toShortString()}</span>
        </div>
        <div className="topbar-status-right">
          <div className="status-chip status-chip-cyan">
            <FleetDpsIcon />
            <span>{s.ships.fleetDps().toShortString()}/s</span>
          </div>
          {hasRelics && (
            <div className="status-chip status-chip-magenta">
              <RelicIcon />
              <span>{displayedRelics.toShortString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
