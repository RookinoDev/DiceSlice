// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/ShipService.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import type { ShipDefinition } from '../config/ShipDefinition'
import type { CurrencyService } from '../economy/CurrencyService'
import { shipCooldown, shipEffectiveDps, shipHitDamage } from '../economy/ShipCombat'
import { upgradeCostExponential } from '../economy/UpgradeCost'
import type { EnemyController } from './EnemyController'

const MAX_HITS_PER_SHIP_PER_TICK = 1000 // safety clamp
/** Flat bonus applied to a critical ship hit's damage (Ancestral Beacon artifact, see #13). */
export const SHIP_CRIT_DAMAGE_MULTIPLIER = 2

/**
 * Owns the fleet: per-ship levels, buy/upgrade (infinite), cooldown-based hits,
 * effective DPS (with milestones + cooldown breakpoints), and idle damage per tick.
 */
export class ShipService {
  private readonly ships: ShipDefinition[]
  private readonly cfg: BalanceConfig
  private readonly levels: number[]
  private readonly timers: number[] // seconds accumulated toward next hit

  /** (shipIndex, newLevel) */
  readonly onShipChanged = new Emitter<{ index: number; level: number }>()
  /** (shipIndex, hitDamage) - for floating numbers. */
  readonly onShipHit = new Emitter<{ index: number; damage: BigNumber; isCrit: boolean }>()

  constructor(ships: ShipDefinition[], cfg: BalanceConfig) {
    this.ships = ships
    this.cfg = cfg
    this.levels = new Array(ships.length).fill(0)
    this.timers = new Array(ships.length).fill(0)
  }

  get count(): number {
    return this.ships.length
  }
  levelOf(i: number): number {
    return this.levels[i]
  }
  isOwned(i: number): boolean {
    return this.levels[i] > 0
  }
  def(i: number): ShipDefinition {
    return this.ships[i]
  }

  nextCost(i: number): BigNumber {
    return upgradeCostExponential(this.levels[i] + 1, this.ships[i].baseCost, this.cfg.shipCostPerLevel)
  }

  cooldown(i: number): number {
    return shipCooldown(this.levels[i], this.ships[i].baseCooldown, this.cfg.shipCooldownBreakpoints, this.cfg.shipCooldownFactor, this.cfg.shipCooldownMin)
  }

  hitDamage(i: number): BigNumber {
    return shipHitDamage(this.levels[i], this.ships[i].baseHitDamage, this.cfg.shipDamagePerLevel, this.cfg.shipMilestoneLevels, this.cfg.shipMilestoneMultipliers)
  }

  shipDps(i: number): BigNumber {
    return this.shipDpsAtLevel(i, this.levels[i])
  }

  /** DPS this ship would have at the next level (level+1, or 1 if not yet owned) - lets the
   *  Fleet screen show "+X DPS" on the buy/upgrade button instead of only the current output. */
  nextLevelDps(i: number): BigNumber {
    return this.shipDpsAtLevel(i, Math.max(1, this.levels[i] + 1))
  }

  private shipDpsAtLevel(i: number, level: number): BigNumber {
    return shipEffectiveDps(
      level,
      this.ships[i].baseHitDamage,
      this.ships[i].baseCooldown,
      this.cfg.shipDamagePerLevel,
      this.cfg.shipCooldownBreakpoints,
      this.cfg.shipCooldownFactor,
      this.cfg.shipCooldownMin,
      this.cfg.shipMilestoneLevels,
      this.cfg.shipMilestoneMultipliers,
    )
  }

  fleetDps(): BigNumber {
    let sum = BigNumber.Zero
    for (let i = 0; i < this.ships.length; i++) sum = sum.add(this.shipDps(i))
    return sum
  }

  buyOrUpgrade(i: number, wallet: CurrencyService): boolean {
    if (!wallet.trySpend(this.nextCost(i))) return false
    this.levels[i]++
    this.onShipChanged.emit({ index: i, level: this.levels[i] })
    return true
  }

  /**
   * Buy/upgrade ship i as many times as the wallet allows (real cost each step ->
   * cannot overspend). Returns levels bought. Capped for safety.
   */
  buyOrUpgradeMax(i: number, wallet: CurrencyService, cap = 100_000): number {
    let n = 0
    while (n < cap && this.buyOrUpgrade(i, wallet)) n++
    return n
  }

  /** Prestige reset: owned ships (level > 0) drop back to level 1, not unowned - a player who
   *  bought a ship keeps it, they just lose the levels invested in it. Ships never bought stay
   *  unowned (0). Previously reset everyone to 0, silently taking ships away on every prestige. */
  resetLevels(): void {
    for (let i = 0; i < this.levels.length; i++) {
      this.levels[i] = this.levels[i] > 0 ? 1 : 0
      this.timers[i] = 0
    }
  }

  /** Restore per-ship levels from a save (extra/short entries ignored). */
  restoreLevels(levels: number[] | undefined | null): void {
    if (!levels) return
    const n = Math.min(levels.length, this.levels.length)
    for (let i = 0; i < n; i++) {
      this.levels[i] = levels[i] < 0 ? 0 : levels[i]
      this.timers[i] = 0
    }
  }

  /** Advance all ship cooldowns by deltaSeconds; idle damage with an optional DPS multiplier
   * and an optional per-hit crit chance (Ancestral Beacon - 0 until unlocked and owned). Each
   * hit rolls independently, same real-randomness reasoning as TapController's crit. */
  tick(deltaSeconds: number, enemy: EnemyController, dpsMultiplier: BigNumber = BigNumber.One, critChance = 0): BigNumber {
    if (!enemy || deltaSeconds <= 0) return BigNumber.Zero

    let total = BigNumber.Zero
    for (let i = 0; i < this.ships.length; i++) {
      if (this.levels[i] <= 0) continue

      const cd = this.cooldown(i)
      this.timers[i] += deltaSeconds

      let hits = 0
      while (this.timers[i] >= cd && hits < MAX_HITS_PER_SHIP_PER_TICK) {
        this.timers[i] -= cd
        const isCrit = Math.random() < critChance
        const hit = this.hitDamage(i)
          .mul(dpsMultiplier)
          .mul(new BigNumber(isCrit ? SHIP_CRIT_DAMAGE_MULTIPLIER : 1))
        if (enemy.current) enemy.applyDamage(hit)
        this.onShipHit.emit({ index: i, damage: hit, isCrit })
        total = total.add(hit)
        hits++
      }
    }
    return total
  }
}
