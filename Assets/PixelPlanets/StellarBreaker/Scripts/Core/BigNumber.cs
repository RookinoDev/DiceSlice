using System;
using System.Globalization;

namespace StellarBreaker.Core
{
    /// <summary>
    /// Mantissa+exponent big number for idle/incremental economy values.
    /// Mantissa is kept normalized to [1,10) (or 0). Exponent is base-10.
    /// Never use raw double/float for currency/HP/damage — use this.
    /// </summary>
    [Serializable]
    public struct BigNumber : IComparable<BigNumber>, IEquatable<BigNumber>
    {
        public double Mantissa { get; private set; }
        public int    Exponent { get; private set; }

        public static readonly BigNumber Zero = new BigNumber(0.0, 0);
        public static readonly BigNumber One  = new BigNumber(1.0, 0);

        // ── Construction ────────────────────────────────────────────
        public BigNumber(double mantissa, int exponent)
        {
            Mantissa = mantissa;
            Exponent = exponent;
            Normalize();
        }

        public BigNumber(double value)
        {
            if (value == 0.0 || double.IsNaN(value) || double.IsInfinity(value))
            {
                Mantissa = 0.0; Exponent = 0; return;
            }
            int    sign = value < 0 ? -1 : 1;
            double abs  = Math.Abs(value);
            int    e    = (int)Math.Floor(Math.Log10(abs));
            Mantissa = sign * (abs / Math.Pow(10, e));
            Exponent = e;
            Normalize();
        }

        void Normalize()
        {
            if (Mantissa == 0.0 || double.IsNaN(Mantissa))
            {
                Mantissa = 0.0; Exponent = 0; return;
            }
            double abs = Math.Abs(Mantissa);
            while (abs >= 10.0) { Mantissa /= 10.0; Exponent++; abs = Math.Abs(Mantissa); }
            while (abs <  1.0)  { Mantissa *= 10.0; Exponent--; abs = Math.Abs(Mantissa); }
        }

        // ── Implicit conversions ────────────────────────────────────
        public static implicit operator BigNumber(double v) => new BigNumber(v);
        public static implicit operator BigNumber(int v)    => new BigNumber((double)v);
        public static implicit operator BigNumber(long v)   => new BigNumber((double)v);

        // ── Arithmetic ──────────────────────────────────────────────
        public static BigNumber operator +(BigNumber a, BigNumber b)
        {
            if (a.Mantissa == 0.0) return b;
            if (b.Mantissa == 0.0) return a;
            if (a.Exponent < b.Exponent) { var t = a; a = b; b = t; }
            int diff = a.Exponent - b.Exponent;
            if (diff > 16) return a;                       // b is negligible
            double m = a.Mantissa + b.Mantissa * Math.Pow(10, -diff);
            return new BigNumber(m, a.Exponent);
        }

        public static BigNumber operator -(BigNumber a) => new BigNumber(-a.Mantissa, a.Exponent);
        public static BigNumber operator -(BigNumber a, BigNumber b) => a + (-b);

        public static BigNumber operator *(BigNumber a, BigNumber b)
        {
            if (a.Mantissa == 0.0 || b.Mantissa == 0.0) return Zero;
            return new BigNumber(a.Mantissa * b.Mantissa, a.Exponent + b.Exponent);
        }

        public static BigNumber operator /(BigNumber a, BigNumber b)
        {
            if (b.Mantissa == 0.0) throw new DivideByZeroException("BigNumber division by zero.");
            if (a.Mantissa == 0.0) return Zero;
            return new BigNumber(a.Mantissa / b.Mantissa, a.Exponent - b.Exponent);
        }

        /// <summary>Raise to a (possibly fractional) power. Mantissa must be ≥ 0.</summary>
        public BigNumber Pow(double power)
        {
            if (Mantissa == 0.0) return Zero;
            if (Mantissa < 0.0) throw new InvalidOperationException("Pow on negative BigNumber.");
            double log10 = (Math.Log10(Mantissa) + Exponent) * power;
            int    ne    = (int)Math.Floor(log10);
            double nm    = Math.Pow(10, log10 - ne);
            return new BigNumber(nm, ne);
        }

        /// <summary>Best-effort conversion to double (may overflow to Infinity for huge values).</summary>
        public double ToDouble() => Mantissa * Math.Pow(10, Exponent);

        // ── Comparison ──────────────────────────────────────────────
        public int CompareTo(BigNumber o)
        {
            int s = Math.Sign(Mantissa), os = Math.Sign(o.Mantissa);
            if (s != os) return s.CompareTo(os);
            if (s == 0)  return 0;
            if (Exponent != o.Exponent)
                return s > 0 ? Exponent.CompareTo(o.Exponent) : o.Exponent.CompareTo(Exponent);
            return s > 0 ? Mantissa.CompareTo(o.Mantissa) : o.Mantissa.CompareTo(Mantissa);
        }

        public static bool operator < (BigNumber a, BigNumber b) => a.CompareTo(b) <  0;
        public static bool operator > (BigNumber a, BigNumber b) => a.CompareTo(b) >  0;
        public static bool operator <=(BigNumber a, BigNumber b) => a.CompareTo(b) <= 0;
        public static bool operator >=(BigNumber a, BigNumber b) => a.CompareTo(b) >= 0;
        public static bool operator ==(BigNumber a, BigNumber b) => a.CompareTo(b) == 0;
        public static bool operator !=(BigNumber a, BigNumber b) => a.CompareTo(b) != 0;

        public bool Equals(BigNumber o) => CompareTo(o) == 0;
        public override bool Equals(object obj) => obj is BigNumber b && Equals(b);
        public override int GetHashCode() => unchecked(Mantissa.GetHashCode() * 397 ^ Exponent);

        /// <summary>Tolerant equality (mantissa difference), robust against float drift.</summary>
        public bool IsClose(BigNumber o, double tol = 1e-6)
        {
            if (Mantissa == 0.0) return Math.Abs(o.Mantissa) < tol;
            if (o.Mantissa == 0.0) return Math.Abs(Mantissa) < tol;
            if (Exponent != o.Exponent) return false;
            return Math.Abs(Mantissa - o.Mantissa) < tol;
        }

        public BigNumber Max(BigNumber o) => this >= o ? this : o;
        public BigNumber Min(BigNumber o) => this <= o ? this : o;

        // ── Display ─────────────────────────────────────────────────
        public string ToShortString()
        {
            if (Mantissa == 0.0) return "0";

            string sign = Mantissa < 0 ? "-" : "";
            double m    = Math.Abs(Mantissa);
            int    e    = Exponent;

            if (e < 3)
            {
                double v = m * Math.Pow(10, e);
                if (Math.Abs(v - Math.Round(v)) < 1e-9 && v < 1e15)
                    return sign + ((long)Math.Round(v)).ToString(CultureInfo.InvariantCulture);
                return sign + v.ToString("0.##", CultureInfo.InvariantCulture);
            }

            int    group  = e / 3;
            int    within = e % 3;
            double disp   = m * Math.Pow(10, within);   // [1,1000)
            string num    = disp >= 100 ? disp.ToString("0", CultureInfo.InvariantCulture)
                          : disp >= 10  ? disp.ToString("0.0", CultureInfo.InvariantCulture)
                                        : disp.ToString("0.00", CultureInfo.InvariantCulture);
            return sign + num + Suffix(group);
        }

        /// <summary>"" K M B T, then aa ab ac … az ba … (Tap-Titans style).</summary>
        static string Suffix(int group)
        {
            switch (group)
            {
                case 0: return "";
                case 1: return "K";
                case 2: return "M";
                case 3: return "B";
                case 4: return "T";
            }
            int idx = group - 5;
            char first  = (char)('a' + idx / 26);
            char second = (char)('a' + idx % 26);
            return string.Concat(first, second);
        }

        public override string ToString() => ToShortString();
    }
}
