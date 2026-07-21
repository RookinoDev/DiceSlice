// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/UI/MainPresenter.cs
import { BigNumber } from '../core/BigNumber'
import type { GameSession } from '../gameplay/GameSession'
import type { SkillType } from '../config/SkillDefinition'
import { artifactBonusAt } from '../config/ArtifactDefinition'

/** One skill button's display state. */
export interface SkillVm {
  type: SkillType
  label: string
  description: string
  unlocked: boolean
  ready: boolean
  active: boolean
  /** active time left, or cooldown left */
  secondsLeft: number
  /** full duration of whichever timer secondsLeft is counting down (active duration or cooldown) - for cooldown-wipe rendering */
  totalSeconds: number
}

/** One artifact button's display state. */
export interface ArtifactVm {
  label: string
  /** e.g. "Lv 3  +15%" */
  levelText: string
  costText: string
  canBuy: boolean
}

/** Immutable snapshot the main screens render (no game-object refs -> easy to test). */
export interface MainViewModel {
  stageLabel: string
  isBoss: boolean
  bossActive: boolean
  bossSecondsLeft: number

  hpText: string
  /** 0..1 */
  hpFraction: number

  stardustText: string
  tapDamageText: string
  tapLevel: number
  fleetDpsText: string

  tapUpgradeCostText: string
  canUpgradeTap: boolean

  hasShip: boolean
  shipButtonText: string
  canBuyShip: boolean

  skills: SkillVm[]
  canPrestige: boolean
  prestigeText: string

  relicsText: string
  artifacts: ArtifactVm[]

  // Progressive disclosure (FTUE): hide systems until they become relevant.
  /** after first gold/kill */
  showUpgradeTap: boolean
  /** first ship owned OR close to affordable */
  showFleet: boolean
  /** relics exist or an artifact is owned */
  showArtifacts: boolean
  /** near/at the unlock stage, or relics exist */
  showPrestige: boolean
}

/** Maps a GameSession to a MainViewModel, mirroring MainPresenter.Build() from Unity. */
export function buildMainViewModel(s: GameSession): MainViewModel {
  const p = s.enemy.current

  const skills: SkillVm[] = s.skillSlots.map((t) => {
    const active = s.skills.isActive(t)
    const secs = active ? s.skills.activeTimeLeft(t) : s.skills.cooldown(t)
    const total = active ? s.skills.fullDuration(t) : s.skills.fullCooldown(t)
    return {
      type: t,
      label: s.skills.name(t),
      description: s.skills.description(t),
      unlocked: s.skills.isUnlocked(t),
      ready: s.skills.canActivate(t),
      active,
      secondsLeft: Math.ceil(secs),
      totalSeconds: total,
    }
  })

  const arts = s.artifacts
  const artifacts: ArtifactVm[] = Array.from({ length: arts.count }, (_, i) => {
    const def = arts.def(i)
    const lvl = arts.levelOf(i)
    const pct = Math.round(artifactBonusAt(def, lvl) * 100)
    return {
      label: def.displayName,
      levelText: `Lv ${lvl}  +${pct}%`,
      costText: arts.nextCost(i).toShortString(),
      canBuy: s.prestige.relics.canAfford(arts.nextCost(i)),
    }
  })

  const ships = s.ships
  const hasShip = ships.count > 0
  const shipButtonText = hasShip
    ? `${ships.def(0).shipName}  ${ships.isOwned(0) ? `Lv ${ships.levelOf(0)}` : 'Buy'}  (${ships.nextCost(0).toShortString()})`
    : '—'

  const progressed = s.tapUpgrade.level > 1 || s.stage.currentStage > 1 || s.stage.highestStage > 1 || s.wallet.balance.gt(BigNumber.Zero)

  const anyShipOwned = ships.count > 0 && ships.fleetDps().gt(BigNumber.Zero)
  const shipClose = ships.count > 0 && s.wallet.balance.mul(new BigNumber(2)).gte(ships.nextCost(0)) // >=50% of first cost
  const showFleet = anyShipOwned || shipClose

  const anyArtifactOwned = Array.from({ length: arts.count }, (_, i) => arts.levelOf(i) > 0).some(Boolean)
  const hasRelics = s.prestige.relics.balance.gt(BigNumber.Zero)
  const showArtifacts = hasRelics || anyArtifactOwned

  const canPrestige = s.canPrestige()
  const showPrestige = canPrestige || hasRelics || s.stage.highestStage >= s.prestigeUnlockStage - 2

  return {
    stageLabel: p ? `Sector ${p.stage}` : '—',
    isBoss: p ? p.isBoss : false,
    bossActive: s.stage.bossActive,
    bossSecondsLeft: Math.ceil(s.stage.bossTimeLeft),

    hpText: p ? `${p.currentHp.toShortString()} / ${p.maxHp.toShortString()}` : '',
    hpFraction: p ? p.hpFraction01() : 0,

    stardustText: s.wallet.balance.toShortString(),
    tapDamageText: s.tapUpgrade.currentDamage.toShortString(),
    tapLevel: s.tapUpgrade.level,
    fleetDpsText: s.ships.fleetDps().toShortString(),

    tapUpgradeCostText: s.tapUpgrade.nextCost.toShortString(),
    canUpgradeTap: s.wallet.canAfford(s.tapUpgrade.nextCost),

    hasShip,
    shipButtonText,
    canBuyShip: hasShip && s.wallet.canAfford(ships.nextCost(0)),

    skills,
    canPrestige,
    prestigeText: `ASCEND  +${s.previewRelics().toShortString()}`,

    relicsText: s.prestige.relics.balance.toShortString(),
    artifacts,

    showUpgradeTap: progressed,
    showFleet,
    showArtifacts,
    showPrestige,
  }
}
