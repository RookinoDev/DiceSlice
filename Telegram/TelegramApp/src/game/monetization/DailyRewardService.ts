// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Monetization/DailyRewardService.cs

/**
 * Daily reward with streak. A "day" is the UTC unix-day index (unix / 86400).
 * Claiming consecutive days increases the streak; a gap resets it to 1.
 */
export class DailyRewardService {
  static readonly SECONDS_PER_DAY = 86400

  private _lastClaimDay = Number.NEGATIVE_INFINITY
  private _streak = 0

  get lastClaimDay(): number {
    return this._lastClaimDay
  }
  get streak(): number {
    return this._streak
  }

  /** Restore persisted state (e.g. from a save). Does not validate - trusted caller. */
  restore(lastClaimDay: number, streak: number): void {
    this._lastClaimDay = lastClaimDay
    this._streak = streak
  }

  private static dayIndex(unixSeconds: number): number {
    return Math.floor(unixSeconds / DailyRewardService.SECONDS_PER_DAY)
  }

  canClaim(nowUnix: number): boolean {
    return DailyRewardService.dayIndex(nowUnix) !== this._lastClaimDay
  }

  /** What the streak would become if claimed right now (whether or not it's actually claimable). */
  previewStreak(nowUnix: number): number {
    const day = DailyRewardService.dayIndex(nowUnix)
    if (day === this._lastClaimDay) return this._streak // already claimed today - stays the same
    return Number.isFinite(this._lastClaimDay) && day === this._lastClaimDay + 1 ? this._streak + 1 : 1
  }

  /** Seconds remaining until the next UTC day boundary (next possible claim). */
  static secondsUntilNextDay(nowUnix: number): number {
    return DailyRewardService.SECONDS_PER_DAY - (nowUnix % DailyRewardService.SECONDS_PER_DAY)
  }

  /** Claim today's reward. Returns the new streak (0 if already claimed today). */
  claim(nowUnix: number): number {
    if (!this.canClaim(nowUnix)) return 0
    this._streak = this.previewStreak(nowUnix)
    this._lastClaimDay = DailyRewardService.dayIndex(nowUnix)
    return this._streak
  }
}
