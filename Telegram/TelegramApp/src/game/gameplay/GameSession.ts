// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/GameSession.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import type { ShipDefinition } from '../config/ShipDefinition'
import { buildDefaultArtifacts } from '../config/ArtifactDefinition'
import { buildDefaultMissions } from '../config/MissionDefinition'
import { buildPrototypeSkills, SkillType } from '../config/SkillDefinition'
import { CurrencyService } from '../economy/CurrencyService'
import { DailyRewardService } from '../monetization/DailyRewardService'
import { dailyGrantsRelic, dailyGoldFor, dayInCycle } from '../economy/DailyRewardTable'
import { ArtifactService } from './ArtifactService'
import { EnemyController } from './EnemyController'
import { MissionService } from './MissionService'
import type { Planet } from './Planet'
import { PrestigeService } from './PrestigeService'
import { ShipService } from './ShipService'
import { SkillService } from './SkillService'
import { StageManager } from './StageManager'
import { TapController } from './TapController'
import { TapDamageUpgrade } from './TapDamageUpgrade'

export interface DailyPreview {
  /** 1..7 in the cycle */
  day: number
  gold: BigNumber
  relic: boolean
  /** true = claimable now / claim just succeeded */
  canClaim: boolean
}

/**
 * Headless composition root for the core loop. StageManager is the single
 * progression authority; skills buff tap/idle; prestige resets the run for Relics.
 */
export class GameSession {
  private readonly cfg: BalanceConfig

  readonly stage: StageManager
  readonly enemy: EnemyController
  readonly wallet = new CurrencyService()
  readonly tapUpgrade: TapDamageUpgrade
  readonly taps: TapController
  readonly ships: ShipService
  readonly skills: SkillService
  readonly prestige: PrestigeService
  readonly artifacts: ArtifactService
  readonly missions: MissionService
  readonly daily = new DailyRewardService()

  /** The active skills exposed to the UI (in display order). */
  readonly skillSlots: readonly SkillType[] = [
    SkillType.Overdrive,
    SkillType.BattleCry,
    SkillType.MeteorStrike,
    SkillType.DroneSwarm,
    SkillType.MidasBeam,
  ]

  readonly onReward = new Emitter<{ planet: Planet; gold: BigNumber; overkill: BigNumber }>()
  /** Short player-facing notices (e.g. boss failed). */
  readonly onMessage = new Emitter<string>()
  /** Damage dealt by an active skill (Meteor instant, Drone auto-tap) - for feedback only. */
  readonly onSkillDamage = new Emitter<BigNumber>()

  constructor(cfg: BalanceConfig, startStage = 1, ships: ShipDefinition[] = []) {
    this.cfg = cfg
    this.tapUpgrade = new TapDamageUpgrade(cfg)
    this.stage = new StageManager(cfg, startStage)
    this.enemy = new EnemyController(this.stage)
    this.ships = new ShipService(ships, cfg)
    this.skills = new SkillService(buildPrototypeSkills(cfg), () => this.tapUpgrade.level)
    this.prestige = new PrestigeService(cfg)
    this.artifacts = new ArtifactService(buildDefaultArtifacts(cfg), this.prestige.relics)
    this.missions = new MissionService(buildDefaultMissions(), this.wallet)

    // Taps are multiplied by the active tap-damage skill buff x permanent tap artifact.
    this.taps = new TapController(this.enemy, this.tapUpgrade, () => this.skills.tapDamageMultiplier().mul(this.artifacts.tapDamageMultiplier()))

    this.enemy.onPlanetKilled.on((e) => this.handleKill(e.planet, e.overkill))
    this.enemy.onPlanetKilled.on(() => this.missions.notifyPlanetDestroyed())
    this.taps.onDamageDealt.on((e) => this.missions.notifyTapDamage(e.amount))
    this.ships.onShipChanged.on(() => this.missions.notifyShipUpgraded())
    this.stage.onBossFailed.on((stage) => this.handleBossFailed(stage))
  }

  begin(): void {
    this.enemy.begin()
  }
  tap(): void {
    this.taps.tap()
  }

  /** Advance boss timer, skill timers, and idle damage (DPS skill-buffed). */
  tick(deltaSeconds: number): BigNumber {
    this.stage.tick(deltaSeconds)
    this.skills.tick(deltaSeconds)

    // Drone Swarm: auto-taps/sec while active -> continuous tap damage.
    const taps = this.skills.droneTapsPerSecond()
    if (taps > 0 && this.enemy.current) {
      const droneDmg = this.tapUpgrade.currentDamage
        .mul(this.skills.tapDamageMultiplier())
        .mul(this.artifacts.tapDamageMultiplier())
        .mul(new BigNumber(taps * deltaSeconds))
      this.enemy.applyDamage(droneDmg)
      this.onSkillDamage.emit(droneDmg)
    }

    return this.ships.tick(deltaSeconds, this.enemy, this.skills.dpsMultiplier().mul(this.artifacts.dpsMultiplier()))
  }

  upgradeTapDamage(): boolean {
    return this.tapUpgrade.tryUpgrade(this.wallet)
  }
  buyShip(i: number): boolean {
    return this.ships.buyOrUpgrade(i, this.wallet)
  }

  /** Buy/upgrade a permanent artifact with Relics. False if unaffordable. */
  buyArtifact(i: number): boolean {
    return this.artifacts.buyOrUpgrade(i)
  }

  /** Claim a completed mission's Gold reward. False if not complete or already claimed. */
  claimMission(i: number): boolean {
    return this.missions.claim(i)
  }

  // -- Buy Max (spend everything affordable; never overspends) --
  upgradeTapDamageMax(): number {
    return this.tapUpgrade.upgradeMax(this.wallet)
  }
  buyShipMax(i: number): number {
    return this.ships.buyOrUpgradeMax(i, this.wallet)
  }
  buyArtifactMax(i: number): number {
    return this.artifacts.buyOrUpgradeMax(i)
  }

  /** Activate a skill: timed buffs start, Meteor deals instant damage. */
  activateSkill(t: SkillType): boolean {
    if (!this.skills.canActivate(t)) return false
    const instant = this.skills.activate(t, this.tapUpgrade.currentDamage)
    if (instant.gt(BigNumber.Zero)) {
      this.enemy.applyDamage(instant)
      this.onSkillDamage.emit(instant)
    }
    return true
  }

  // -- Prestige --
  /** Stage at which prestige unlocks (read-only, for UI reveal rules). */
  get prestigeUnlockStage(): number {
    return this.cfg.prestigeUnlockStage
  }
  /** Full boss-timer duration in seconds (for UI fill bars). */
  get bossTimerSeconds(): number {
    return this.cfg.bossTimerSeconds
  }
  canPrestige(): boolean {
    return this.stage.highestStage >= this.cfg.prestigeUnlockStage
  }
  previewRelics(): BigNumber {
    return this.prestige.relicsForStage(this.stage.highestStage)
  }

  /** Reset the run for Relics. Returns Relics gained (0 if not unlocked). */
  doPrestige(): BigNumber {
    if (!this.canPrestige()) return BigNumber.Zero
    const gained = this.prestige.prestige(this.stage.highestStage, this.wallet, this.tapUpgrade, this.ships, this.stage)
    this.stage.begin() // re-enter stage 1 -> spawns a fresh planet
    return gained
  }

  // -- Daily reward --
  /** What claiming right now would grant, without claiming it. */
  previewDaily(nowUnixSeconds: number): DailyPreview {
    const can = this.daily.canClaim(nowUnixSeconds)
    const streak = this.daily.previewStreak(nowUnixSeconds)
    const day = dayInCycle(streak)
    const oneKillGold = this.stage.goldFor(this.stage.currentStage)
    const gold = dailyGoldFor(streak, oneKillGold, this.cfg)
    const relic = dailyGrantsRelic(streak, this.cfg) && this.stage.highestStage >= this.cfg.prestigeUnlockStage
    return { day, gold, relic, canClaim: can }
  }

  /**
   * Gold preview for a specific day-in-cycle (1..7), independent of the current
   * streak - used to render the full 7-day reward grid at once.
   */
  dailyGoldForDay(dayInCycleNum: number): BigNumber {
    const oneKillGold = this.stage.goldFor(this.stage.currentStage)
    return dailyGoldFor(dayInCycleNum, oneKillGold, this.cfg)
  }

  /** True if the given day-in-cycle (1..7) additionally grants a Relic. */
  dailyGrantsRelicOnDay(dayInCycleNum: number): boolean {
    return dailyGrantsRelic(dayInCycleNum, this.cfg)
  }

  /** Claim today's daily reward. Returns what was granted (canClaim=false if already claimed today). */
  claimDaily(nowUnixSeconds: number): DailyPreview {
    const preview = this.previewDaily(nowUnixSeconds)
    if (!preview.canClaim) return preview

    this.daily.claim(nowUnixSeconds)
    this.wallet.add(preview.gold)
    if (preview.relic) this.prestige.relics.add(BigNumber.One)
    return preview
  }

  private handleKill(planet: Planet, overkill: BigNumber): void {
    const gold = this.stage.goldFor(planet.stage).mul(this.artifacts.goldMultiplier()).mul(this.skills.goldMultiplier())
    this.wallet.add(gold)
    this.onReward.emit({ planet, gold, overkill })
  }

  // Boss-fail fallback: drop to the previous normal stage to farm power, then
  // re-advance into the boss again. Avoids the no-income soft-lock.
  private handleBossFailed(stage: number): void {
    const farmStage = stage - 1
    this.stage.goToStage(farmStage)
    this.onMessage.emit(`Boss failed - returned to Sector ${farmStage}. Farm more power and retry!`)
  }
}
