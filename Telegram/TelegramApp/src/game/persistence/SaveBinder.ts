// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Persistence/SaveBinder.cs
import { BigNumber, toBigNumberData } from '../core/BigNumber'
import type { GameSession } from '../gameplay/GameSession'
import { DailyRewardService } from '../monetization/DailyRewardService'
import type { SaveState } from './SaveState'

/**
 * Maps GameSession <-> SaveState. Boss state is intentionally not saved
 * (a boss stage restarts cleanly on load).
 */
export function captureSave(s: GameSession): SaveState {
  return {
    version: 1,
    stardust: toBigNumberData(s.wallet.balance),
    relics: toBigNumberData(s.prestige.relics.balance),
    antimatter: toBigNumberData(BigNumber.Zero),
    tapLevel: s.tapUpgrade.level,
    shipLevels: captureShipLevels(s),
    artifactLevels: captureArtifactLevels(s),
    missionProgress: s.missions.captureProgress(),
    missionClaimed: s.missions.captureClaimed(),
    currentStage: s.stage.currentStage,
    highestStage: s.stage.highestStage,
    lastSaveUnixSeconds: Math.floor(Date.now() / 1000),
    lastDailyClaimUnixSeconds: Number.isFinite(s.daily.lastClaimDay) ? s.daily.lastClaimDay * DailyRewardService.SECONDS_PER_DAY : 0,
    dailyStreak: s.daily.streak,
    stats: { ...s.stats, deepestStage: Math.max(s.stats.deepestStage, s.stage.highestStage) },
    offlineCapBonusHours: s.boosts.offlineCapBonusHours,
    vipExpiresUnixSeconds: s.boosts.vipExpiresUnixSeconds,
  }
}

export function applySave(s: GameSession, st: SaveState): void {
  s.stage.restoreProgress(st.currentStage, st.highestStage) // before begin()
  s.wallet.set(new BigNumber(st.stardust.mantissa, st.stardust.exponent))
  s.prestige.relics.set(new BigNumber(st.relics.mantissa, st.relics.exponent))
  s.tapUpgrade.reset(Math.max(1, st.tapLevel))
  s.ships.restoreLevels(st.shipLevels)
  s.artifacts.restoreLevels(st.artifactLevels)
  s.missions.restoreProgress(st.missionProgress, st.missionClaimed)
  s.boosts.offlineCapBonusHours = st.offlineCapBonusHours ?? 0
  s.boosts.vipExpiresUnixSeconds = st.vipExpiresUnixSeconds ?? 0
  if (st.lastDailyClaimUnixSeconds > 0) {
    s.daily.restore(Math.floor(st.lastDailyClaimUnixSeconds / DailyRewardService.SECONDS_PER_DAY), st.dailyStreak)
  }
  if (st.stats) {
    Object.assign(s.stats, st.stats)
  } else {
    // Pre-profile save: seed what we can infer so profiles never show zeros for veterans.
    s.stats.deepestStage = st.highestStage
    if (st.lastSaveUnixSeconds > 0) s.stats.firstPlayedUnixSeconds = st.lastSaveUnixSeconds
  }
  s.stats.deepestStage = Math.max(s.stats.deepestStage, st.highestStage)
  // Pre-#pack-dedup save: deepestBossCleared wasn't tracked yet. Backfill the highest boss
  // stage at-or-below deepestStage (reaching any stage past a boss REQUIRES having cleared
  // it - see StageManager.notifyPlanetKilled) so a migrating veteran's already-earned packs
  // aren't reinterpreted as "0 unique bosses cleared" and reset to zero. The server's own
  // grant floor (pack_progress.bosses_granted) is the actual safety net against a double
  // grant either way - see db.mjs's grantPacksFromSave.
  if (!st.stats || st.stats.deepestBossCleared === undefined) {
    let backfilled = 0
    for (let stage = s.stats.deepestStage; stage >= 1; stage--) {
      if (s.stage.isBossStage(stage)) {
        backfilled = stage
        break
      }
    }
    s.stats.deepestBossCleared = backfilled
  }
}

function captureShipLevels(s: GameSession): number[] {
  return Array.from({ length: s.ships.count }, (_, i) => s.ships.levelOf(i))
}

function captureArtifactLevels(s: GameSession): number[] {
  return Array.from({ length: s.artifacts.count }, (_, i) => s.artifacts.levelOf(i))
}
