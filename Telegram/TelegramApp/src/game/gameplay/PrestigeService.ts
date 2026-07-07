// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/PrestigeService.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import type { BalanceConfig } from '../config/BalanceConfig'
import { CurrencyService } from '../economy/CurrencyService'
import type { ShipService } from './ShipService'
import type { StageManager } from './StageManager'
import type { TapDamageUpgrade } from './TapDamageUpgrade'

/**
 * Prestige: convert progress into Relics and reset run state. Relics + artifacts persist.
 *   Relics(stage) = floor( scale * max(0, stage - startStage)^power ).
 */
export class PrestigeService {
  private readonly cfg: BalanceConfig

  /** Persistent Relic balance (the prestige currency). */
  readonly relics = new CurrencyService()

  readonly onPrestiged = new Emitter<BigNumber>() // relics gained

  constructor(cfg: BalanceConfig) {
    this.cfg = cfg
  }

  relicsForStage(highestStage: number): BigNumber {
    const s = Math.max(0, highestStage - this.cfg.relicStartStage)
    if (s <= 0) return BigNumber.Zero
    const r = this.cfg.relicScale * Math.pow(s, this.cfg.relicPower)
    return new BigNumber(Math.floor(r))
  }

  /**
   * Perform a prestige: award Relics from the highest stage, then reset the run
   * (Stardust, tap level, ship levels, stage). Returns Relics gained.
   */
  prestige(highestStage: number, stardust: CurrencyService, tap: TapDamageUpgrade, ships: ShipService, stage: StageManager): BigNumber {
    const gained = this.relicsForStage(highestStage)
    this.relics.add(gained)

    stardust.set(BigNumber.Zero)
    tap.reset()
    ships.resetLevels()
    stage.resetForPrestige()

    this.onPrestiged.emit(gained)
    return gained
  }
}
