import { BigNumber } from '../core/BigNumber'

/** Flat Stardust multiplier while the VIP pass (vip_pass_30d) is active. */
const VIP_GOLD_MULTIPLIER = new BigNumber(1.25)

/** Small persisted state for one-off/timed shop purchases that don't belong to any single
 *  existing subsystem - grouped here rather than scattered as loose fields on GameSession,
 *  same shape as ArtifactService/SkillService each owning their own small store. */
export class MonetizationBoosts {
  /** Permanent hours added to BalanceConfig.offlineCapHours by the one-time offline cap
   *  purchase (see OfflineEarnings.ts's bonusHours param). */
  offlineCapBonusHours = 0

  /** Unix seconds the VIP pass's passive Stardust bonus expires - 0 = never bought / lapsed.
   *  A repurchase while still active extends from the current expiry rather than from now, so
   *  buying early never wastes remaining days (see purchases.ts's vip_pass_30d grant). Compared
   *  against real wall-clock time (a 30-day pass keeps running while the app is closed), unlike
   *  the rest of GameSession which is always handed "now" explicitly by its caller - reading the
   *  clock here directly is a deliberate, narrow exception for that reason. */
  vipExpiresUnixSeconds = 0

  private isVipActive(): boolean {
    return this.vipExpiresUnixSeconds > Math.floor(Date.now() / 1000)
  }

  /** Passive Stardust multiplier from an active VIP pass (see GameSession.handleKill). 1x (no
   *  effect) once vipExpiresUnixSeconds has passed. */
  vipGoldMultiplier(): BigNumber {
    return this.isVipActive() ? VIP_GOLD_MULTIPLIER : BigNumber.One
  }
}
