// Ported from GamePhone.dc.html's top bar + upper status row.
import { useEffect, useRef } from 'react'
import { BigNumber } from '../game/core/BigNumber'
import type { GameSession } from '../game/gameplay/GameSession'
import { nowUnixSeconds } from '../game/persistence/localStorageSave'
import { audio } from '../game/audio/AudioManager'
import { useCountUp } from './useCountUp'
import { registerLandmark } from './combatFx/landmarks'
import {
  SettingsIcon,
  ProfileIcon,
  MissionsBellIcon,
  DailyGiftIcon,
  AchievementsIcon,
  LeaderboardIcon,
  ShopIcon,
  GoldIcon,
  FleetDpsIcon,
  RelicIcon,
} from './icons'

interface TopBarProps {
  session: GameSession
  onSettingsClick: () => void
  onProfileClick: () => void
  onNotificationClick: () => void
  onDailyClick: () => void
  onAchievementsClick: () => void
  onLeaderboardClick: () => void
  onShopClick: () => void
}

export function TopBar({
  session: s,
  onSettingsClick,
  onProfileClick,
  onNotificationClick,
  onDailyClick,
  onAchievementsClick,
  onLeaderboardClick,
  onShopClick,
}: TopBarProps) {
  const hasRelics = s.prestige.relics.balance.gt(BigNumber.Zero) || s.canPrestige()

  let anyMissionClaimable = false
  for (let i = 0; i < s.missions.count; i++) {
    if (s.missions.isComplete(i) && !s.missions.isClaimed(i)) {
      anyMissionClaimable = true
      break
    }
  }
  const dailyClaimable = s.daily.canClaim(nowUnixSeconds())
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
              onSettingsClick()
            }}
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
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
        </div>

        <div className="topbar-icon-group">
          <button
            className="topbar-icon-btn"
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
            ref={(el) => registerLandmark('topbar-daily', el)}
            onClick={() => {
              audio.click()
              onDailyClick()
            }}
            aria-label="Daily reward"
          >
            <DailyGiftIcon />
            {dailyClaimable && <span className="dot dot-daily" />}
          </button>
          <button
            className="topbar-icon-btn"
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
              onShopClick()
            }}
            aria-label="Shop"
          >
            <ShopIcon />
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
