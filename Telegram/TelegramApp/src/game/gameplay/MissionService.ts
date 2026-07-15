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

  /** Reward for claiming mission i right now, given the caller's current one-kill-gold value. */
  rewardFor(i: number, oneKillGold: BigNumber): BigNumber {
    return oneKillGold.mul(new BigNumber(this.defs[i].rewardMult))
  }

  /** For each mission type present, the index of its lowest-level unclaimed mission (the one
   * the UI should show as the active step of that chain) - undefined if the whole chain is
   * claimed. Assumes defs are grouped by type with ascending level (see buildDefaultMissions). */
  activeIndices(): number[] {
    const seen = new Set<MissionType>()
    const out: number[] = []
    for (let i = 0; i < this.defs.length; i++) {
      const type = this.defs[i].type
      if (seen.has(type)) continue
      if (this.claimed[i]) continue
      seen.add(type)
      out.push(i)
    }
    return out
  }

  claim(i: number, oneKillGold: BigNumber): boolean {
    if (i < 0 || i >= this.defs.length) return false
    if (this.claimed[i] || !this.isComplete(i)) return false
    this.claimed[i] = true
    const reward = this.rewardFor(i, oneKillGold)
    this.wallet.add(reward)
    this.onClaimed.emit({ index: i, gold: reward })
    return true
  }

  // -- event hooks (wired by GameSession) --
  notifyPlanetDestroyed(): void {
    this.addProgress(MissionType.DestroyPlanets, BigNumber.One)
  }
  notifyBossDefeated(): void {
    this.addProgress(MissionType.DestroyBosses, BigNumber.One)
  }
  notifyTapDamage(dmg: BigNumber): void {
    this.addProgress(MissionType.TapDamageTotal, dmg)
  }
  notifyTapCount(): void {
    this.addProgress(MissionType.TapCount, BigNumber.One)
  }
  notifyShipUpgraded(): void {
    this.addProgress(MissionType.ShipUpgrades, BigNumber.One)
  }
  notifyPrestiged(): void {
    this.addProgress(MissionType.Prestige, BigNumber.One)
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

  // Restores only on an exact length match against the current mission list. The Sprint 5
  // expansion (3 fixed missions -> 180 generated ones) changed what each index means, so a
  // shorter saved array can't be safely mapped position-by-position - a save from the old
  // shape (or any future reshuffle) is deliberately discarded here rather than risking a
  // mismatched type showing as pre-claimed (a silently lost reward) or pre-completed.
  restoreProgress(progress: BigNumberData[] | undefined | null, claimed: boolean[] | undefined | null): void {
    if (progress && progress.length === this.progress.length) {
      for (let i = 0; i < progress.length; i++) this.progress[i] = fromBigNumberData(progress[i])
    }
    if (claimed && claimed.length === this.claimed.length) {
      for (let i = 0; i < claimed.length; i++) this.claimed[i] = claimed[i]
    }
  }
}
