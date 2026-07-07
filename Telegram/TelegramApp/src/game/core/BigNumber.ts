// Mantissa+exponent big number for idle/incremental economy values.
// Mantissa is kept normalized to [1,10) (or 0). Exponent is base-10.
// Never use raw number for currency/HP/damage in the game layer - use this.
export class BigNumber {
  readonly mantissa: number
  readonly exponent: number

  static readonly Zero = new BigNumber(0, 0)
  static readonly One = new BigNumber(1, 0)

  constructor(mantissa: number, exponent = 0) {
    if (mantissa === 0 || Number.isNaN(mantissa) || !Number.isFinite(mantissa)) {
      this.mantissa = 0
      this.exponent = 0
      return
    }
    ;[this.mantissa, this.exponent] = normalize(mantissa, exponent)
  }

  static from(value: number): BigNumber {
    return new BigNumber(value)
  }

  add(o: BigNumber): BigNumber {
    let a: BigNumber = this
    let b: BigNumber = o
    if (a.mantissa === 0) return b
    if (b.mantissa === 0) return a
    if (a.exponent < b.exponent) [a, b] = [b, a]
    const diff = a.exponent - b.exponent
    if (diff > 16) return a
    const m = a.mantissa + b.mantissa * Math.pow(10, -diff)
    return new BigNumber(m, a.exponent)
  }

  neg(): BigNumber {
    return new BigNumber(-this.mantissa, this.exponent)
  }

  sub(o: BigNumber): BigNumber {
    return this.add(o.neg())
  }

  mul(o: BigNumber): BigNumber {
    if (this.mantissa === 0 || o.mantissa === 0) return BigNumber.Zero
    return new BigNumber(this.mantissa * o.mantissa, this.exponent + o.exponent)
  }

  div(o: BigNumber): BigNumber {
    if (o.mantissa === 0) throw new Error('BigNumber division by zero.')
    if (this.mantissa === 0) return BigNumber.Zero
    return new BigNumber(this.mantissa / o.mantissa, this.exponent - o.exponent)
  }

  /** Raise to a (possibly fractional) power. Mantissa must be >= 0. */
  pow(power: number): BigNumber {
    if (this.mantissa === 0) return BigNumber.Zero
    if (this.mantissa < 0) throw new Error('Pow on negative BigNumber.')
    const log10 = (Math.log10(this.mantissa) + this.exponent) * power
    const ne = Math.floor(log10)
    const nm = Math.pow(10, log10 - ne)
    return new BigNumber(nm, ne)
  }

  /** Best-effort conversion to number (may overflow to Infinity for huge values). */
  toNumber(): number {
    return this.mantissa * Math.pow(10, this.exponent)
  }

  compareTo(o: BigNumber): number {
    const s = Math.sign(this.mantissa)
    const os = Math.sign(o.mantissa)
    if (s !== os) return s < os ? -1 : s > os ? 1 : 0
    if (s === 0) return 0
    if (this.exponent !== o.exponent) {
      return s > 0
        ? this.exponent < o.exponent
          ? -1
          : 1
        : o.exponent < this.exponent
          ? -1
          : 1
    }
    const cmp = s > 0 ? this.mantissa - o.mantissa : o.mantissa - this.mantissa
    return cmp < 0 ? -1 : cmp > 0 ? 1 : 0
  }

  lt(o: BigNumber): boolean {
    return this.compareTo(o) < 0
  }
  gt(o: BigNumber): boolean {
    return this.compareTo(o) > 0
  }
  lte(o: BigNumber): boolean {
    return this.compareTo(o) <= 0
  }
  gte(o: BigNumber): boolean {
    return this.compareTo(o) >= 0
  }
  eq(o: BigNumber): boolean {
    return this.compareTo(o) === 0
  }

  /** Tolerant equality (mantissa difference), robust against float drift. */
  isClose(o: BigNumber, tol = 1e-6): boolean {
    if (this.mantissa === 0) return Math.abs(o.mantissa) < tol
    if (o.mantissa === 0) return Math.abs(this.mantissa) < tol
    if (this.exponent !== o.exponent) return false
    return Math.abs(this.mantissa - o.mantissa) < tol
  }

  max(o: BigNumber): BigNumber {
    return this.gte(o) ? this : o
  }
  min(o: BigNumber): BigNumber {
    return this.lte(o) ? this : o
  }

  /** "" K M B T, then aa ab ac ... az ba ... (Tap-Titans style). */
  toShortString(): string {
    if (this.mantissa === 0) return '0'

    const sign = this.mantissa < 0 ? '-' : ''
    const m = Math.abs(this.mantissa)
    const e = this.exponent

    if (e < 3) {
      const v = m * Math.pow(10, e)
      if (Math.abs(v - Math.round(v)) < 1e-9 && v < 1e15) return sign + Math.round(v).toString()
      return sign + trimDecimals(v, 2)
    }

    const group = Math.floor(e / 3)
    const within = e % 3
    const disp = m * Math.pow(10, within) // [1,1000)
    const num = disp >= 100 ? disp.toFixed(0) : disp >= 10 ? disp.toFixed(1) : disp.toFixed(2)
    return sign + num + suffix(group)
  }

  toString(): string {
    return this.toShortString()
  }
}

function normalize(mantissa: number, exponent: number): [number, number] {
  if (mantissa === 0 || Number.isNaN(mantissa)) return [0, 0]
  let m = mantissa
  let e = exponent
  let abs = Math.abs(m)
  while (abs >= 10) {
    m /= 10
    e++
    abs = Math.abs(m)
  }
  while (abs < 1) {
    m *= 10
    e--
    abs = Math.abs(m)
  }
  return [m, e]
}

function trimDecimals(v: number, maxDecimals: number): string {
  const s = v.toFixed(maxDecimals)
  return s.replace(/\.?0+$/, '') || '0'
}

function suffix(group: number): string {
  switch (group) {
    case 0:
      return ''
    case 1:
      return 'K'
    case 2:
      return 'M'
    case 3:
      return 'B'
    case 4:
      return 'T'
  }
  const idx = group - 5
  const first = String.fromCharCode(97 + Math.floor(idx / 26))
  const second = String.fromCharCode(97 + (idx % 26))
  return first + second
}

/** JSON-serializable form of a BigNumber, mirroring the Unity save format. */
export interface BigNumberData {
  mantissa: number
  exponent: number
}

export function toBigNumberData(b: BigNumber): BigNumberData {
  return { mantissa: b.mantissa, exponent: b.exponent }
}

export function fromBigNumberData(d: BigNumberData): BigNumber {
  return new BigNumber(d.mantissa, d.exponent)
}

