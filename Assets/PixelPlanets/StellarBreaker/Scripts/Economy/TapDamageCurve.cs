using System;
using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Closed-form tap-damage curve. The per-level multiplier eases from `start`
    /// (early) toward `end` (asymptotic):
    ///
    ///   ratio(L)  = end · (start/end)^(decay^(L-1))
    ///   damage(L) = base · ∏_{i=1..L-1} ratio(i)
    ///             = base · end^(L-1) · (start/end)^( (1 - decay^(L-1)) / (1 - decay) )
    ///
    /// O(1), exact for arbitrarily large levels via BigNumber.
    /// </summary>
    public static class TapDamageCurve
    {
        public static BigNumber ForLevel(int level, double baseDmg, double start, double end, double decay)
        {
            if (level <= 1) return new BigNumber(baseDmg);

            int n = level - 1;
            var endPow = new BigNumber(end).Pow(n);

            // Geometric sum of the decaying excess exponent.
            double g = (1.0 - Math.Pow(decay, n)) / (1.0 - decay);
            var ratioPow = new BigNumber(start / end).Pow(g);

            return new BigNumber(baseDmg) * endPow * ratioPow;
        }

        public static BigNumber ForLevel(int level, BalanceConfig cfg)
            => ForLevel(level, cfg.tapDamageBase, cfg.tapGrowthStart, cfg.tapGrowthEnd, cfg.tapGrowthDecay);
    }
}
