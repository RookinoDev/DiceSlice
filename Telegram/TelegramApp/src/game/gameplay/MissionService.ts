// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/MissionService.cs
import { BigNumber, toBigNumberData, fromBigNumberData, type BigNumberData } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { MissionType, type MissionDefinition } from '../config/MissionDefinition'
import type { CurrencyService } from '../economy/CurrencyService'

/**
 * Fixed one-shot quest list (no rotation/re-roll in this pass). Tracks a running BigNumber
 * counter per mission (planets destroyed / cumulative tap damage / ship upgrades bought),
 * and lets the UI claim a Gold reward once the target is reached. Claimed missions stay
 * claimed forever (persisted).
 */
export class MissionService {
  private readonly defs: MissionDefinition[]
  private readonly wallet: CurrencyService
  private readonly progress: BigNumber[]
  private readonly claimed: boolean[]

  /** (missionIndex) fired when a mission's progress changes. */
  readonly onProgressChanged = new Emitter<number>()
  /** (missionIndex, goldPaid) fired when a mission is claimed. */
  readonly onClaimed = new Emitter<{ index: number; gold: BigNumber }>()

  constructor(defs: MissionDefinition[], wallet: CurrencyService) {
    this.defs = defs
    this.wallet = wallet
    this.progress = new Array(defs.length).fill(BigNumber.Zero)
    this.claimed = new Array(defs.length).fill(false)
  }

  get count(): number {
    return this.defs.length
  }
  def(i: number): MissionDefinition {
    return this.defs[i]
  }
  progressOf(i: number): BigNumber {
    return this.progress[i]
  }
  isClaimed(i: number): boolean {
    return this.claimed[i]
  }
  isComplete(i: number): boolean {
    return this.progress[i].gte(new BigNumber(this.defs[i].target))
  }

  /** 0..1, clamped - for progress bars. */
  progress01(i: number): number {
    const target = Math.max(1e-9, this.defs[i].target)
    const frac = this.progress[i].toNumber() / target
    return Math.min(1, Math.max(0, frac))
  }

  claim(i: number): boolean {
    if (i < 0 || i >= this.defs.length) return false
    if (this.claimed[i] || !this.isComplete(i)) return false
    this.claimed[i] = true
    const reward = new BigNumber(this.defs[i].goldReward)
    this.wallet.add(reward)
    this.onClaimed.emit({ index: i, gold: reward })
    return true
  }

  // -- event hooks (wired by GameSession) --
  notifyPlanetDestroyed(): void {
    this.addProgress(MissionType.DestroyPlanets, BigNumber.One)
  }
  notifyTapDamage(dmg: BigNumber): void {
    this.addProgress(MissionType.TapDamageTotal, dmg)
  }
  notifyShipUpgraded(): void {
    this.addProgress(MissionType.ShipUpgrades, BigNumber.One)
  }

  private addProgress(type: MissionType, amount: BigNumber): void {
    for (let i = 0; i < this.defs.length; i++) {
      if (this.defs[i].type !== type || this.claimed[i]) continue
      this.progress[i] = this.progress[i].add(amount)
      this.onProgressChanged.emit(i)
    }
  }

  // -- save/load --
  captureProgress(): BigNumberData[] {
    return this.progress.map(toBigNumberData)
  }

  captureClaimed(): boolean[] {
    return [...this.claimed]
  }

  restoreProgress(progress: BigNumberData[] | undefined | null, claimed: boolean[] | undefined | null): void {
    if (progress) {
      const n = Math.min(progress.length, this.progress.length)
      for (let i = 0; i < n; i++) this.progress[i] = fromBigNumberData(progress[i])
    }
    if (claimed) {
      const n = Math.min(claimed.length, this.claimed.length)
      for (let i = 0; i < n; i++) this.claimed[i] = claimed[i]
    }
  }
}
