// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Economy/CurrencyService.cs
import { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'

/** Holds a currency balance (Stardust or Relics) as a BigNumber. */
export class CurrencyService {
  private _balance: BigNumber = BigNumber.Zero

  /** Fired whenever the balance changes; passes the new balance. */
  readonly onChanged = new Emitter<BigNumber>()

  get balance(): BigNumber {
    return this._balance
  }

  add(amount: BigNumber): void {
    if (amount.lte(BigNumber.Zero)) return
    this._balance = this._balance.add(amount)
    this.onChanged.emit(this._balance)
  }

  canAfford(cost: BigNumber): boolean {
    return this._balance.gte(cost)
  }

  /** Deduct cost if affordable. Returns false (no change) otherwise. */
  trySpend(cost: BigNumber): boolean {
    if (cost.lt(BigNumber.Zero)) return false
    if (this._balance.lt(cost)) return false
    this._balance = this._balance.sub(cost)
    this.onChanged.emit(this._balance)
    return true
  }

  /** Directly set the balance (for save/load or tests). */
  set(value: BigNumber): void {
    this._balance = value
    this.onChanged.emit(this._balance)
  }
}
