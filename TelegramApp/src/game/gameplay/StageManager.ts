// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/StageManager.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import { enemyHpForStage } from '../economy/EnemyHp'
import { goldRewardForStage } from '../economy/GoldReward'

/**
 * Authoritative progression: current stage, boss detection (every Nth stage),
 * the [2,4,6,7,10] multiplier cycle, boss HP/gold, and the boss timer gate.
 */
export class StageManager {
  private readonly cfg: BalanceConfig

  private _currentStage: number
  private _highestStage: number
  private _bossActive = false
  private _bossTimeLeft = 0

  readonly onStageEntered = new Emitter<number>()
  readonly onBossStarted = new Emitter<number>()
  readonly onBossCleared = new Emitter<number>()
  readonly onBossFailed = new Emitter<number>()

  constructor(cfg: BalanceConfig, startStage = 1) {
    this.cfg = cfg
    this._currentStage = Math.max(1, startStage)
    this._highestStage = this._currentStage
  }

  get currentStage(): number {
    return this._currentStage
  }
  get highestStage(): number {
    return this._highestStage
  }
  get bossActive(): boolean {
    return this._bossActive
  }
  get bossTimeLeft(): number {
    return this._bossTimeLeft
  }

  isBossStage(stage: number): boolean {
    return this.cfg.bossStageInterval > 0 && stage % this.cfg.bossStageInterval === 0
  }

  get currentIsBoss(): boolean {
    return this.isBossStage(this._currentStage)
  }

  bossMultiplier(stage: number): number {
    const m = this.cfg.bossMultipliers
    if (!this.isBossStage(stage) || !m || m.length === 0) return 1
    const idx = stage / this.cfg.bossStageInterval - 1 // 0-based boss index
    const wrapped = ((idx % m.length) + m.length) % m.length
    return m[wrapped]
  }

  hpFor(stage: number): BigNumber {
    let hp = enemyHpForStage(stage, this.cfg.enemyHpBase, this.cfg.enemyHpGrowth)
    if (this.isBossStage(stage)) hp = hp.mul(new BigNumber(this.bossMultiplier(stage)))
    return hp
  }

  /**
   * Gold multiplier for a boss kill, scaled by that boss's own HP multiplier so a
   * harder boss (up to x10 HP) pays out more than an easy one (x2 HP) instead of the
   * same flat bonus. Square-root scaling keeps it sub-linear.
   */
  bossRewardMultiplier(stage: number): number {
    return this.isBossStage(stage) ? this.cfg.bossGoldMultiplier * Math.sqrt(this.bossMultiplier(stage)) : 1.0
  }

  goldFor(stage: number): BigNumber {
    let g = goldRewardForStage(stage, this.cfg.goldBase, this.cfg.goldGrowth)
    if (this.isBossStage(stage)) g = g.mul(new BigNumber(this.bossRewardMultiplier(stage)))
    return g
  }

  /** Activate the current stage (starts the boss timer if it's a boss). */
  begin(): void {
    this.enterStage(this._currentStage)
  }

  private enterStage(stage: number): void {
    this._currentStage = stage
    if (stage > this._highestStage) this._highestStage = stage
    this.onStageEntered.emit(stage)

    if (this.isBossStage(stage)) {
      this._bossActive = true
      this._bossTimeLeft = this.cfg.bossTimerSeconds
      this.onBossStarted.emit(stage)
    } else {
      this._bossActive = false
      this._bossTimeLeft = 0
    }
  }

  /** The active planet was destroyed. Clears a boss (advance) or advances normally. */
  notifyPlanetKilled(): void {
    if (this.isBossStage(this._currentStage)) {
      if (!this._bossActive) return // failed boss must be retried first
      this._bossActive = false
      this.onBossCleared.emit(this._currentStage)
    }
    this.enterStage(this._currentStage + 1)
  }

  /** Advance the boss timer. On expiry the boss fails and you keep the stage. */
  tick(deltaSeconds: number): void {
    if (!this._bossActive) return
    this._bossTimeLeft -= deltaSeconds
    if (this._bossTimeLeft <= 0) {
      this._bossTimeLeft = 0
      this._bossActive = false
      this.onBossFailed.emit(this._currentStage) // stays on stage
    }
  }

  /** Move to a specific stage and (re)spawn it. Used by the boss-fail farm fallback. */
  goToStage(stage: number): void {
    this.enterStage(Math.max(1, stage))
  }

  /** Re-arm the boss timer after a failure to attempt again. */
  retryBoss(): void {
    if (this.isBossStage(this._currentStage) && !this._bossActive) {
      this._bossActive = true
      this._bossTimeLeft = this.cfg.bossTimerSeconds
      this.onBossStarted.emit(this._currentStage)
    }
  }

  /** Reset to stage 1 (used by prestige). Keeps highestStage. */
  resetToStart(): void {
    this._currentStage = 1
    this._bossActive = false
    this._bossTimeLeft = 0
  }

  /** Full reset for prestige: back to stage 1 and clear highestStage (run-based). */
  resetForPrestige(): void {
    this._currentStage = 1
    this._highestStage = 1
    this._bossActive = false
    this._bossTimeLeft = 0
  }

  /** Restore progress from a save (call before begin()). Boss restarts cleanly. */
  restoreProgress(current: number, highest: number): void {
    this._currentStage = Math.max(1, current)
    this._highestStage = Math.max(this._currentStage, Math.max(1, highest))
    this._bossActive = false
    this._bossTimeLeft = 0
  }
}
