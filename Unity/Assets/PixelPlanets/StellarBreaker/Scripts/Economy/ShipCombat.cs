using System;
using StellarBreaker.Core;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Cooldown-based ship combat math.
    ///   HitDamage(level) = baseHit × 1.27^(level-1) × MilestoneMultiplier(level)
    ///   Cooldown(level)  = max(min, baseCd × factor^(breakpoints passed))
    ///   EffectiveDPS     = HitDamage / Cooldown
    /// </summary>
    public static class ShipCombat
    {
        public static BigNumber MilestoneMultiplier(int level, int[] levels, double[] multipliers)
        {
            var m = BigNumber.One;
            if (levels == null || multipliers == null) return m;
            int n = Math.Min(levels.Length, multipliers.Length);
            for (int i = 0; i < n; i++)
                if (level >= levels[i]) m = m * new BigNumber(multipliers[i]);
            return m;
        }

        public static int BreakpointsPassed(int level, int[] breakpoints)
        {
            if (breakpoints == null) return 0;
            int c = 0;
            for (int i = 0; i < breakpoints.Length; i++)
                if (level >= breakpoints[i]) c++;
            return c;
        }

        public static double Cooldown(int level, double baseCd,
                                      int[] breakpoints, double factor, double min)
        {
            if (level <= 0) return baseCd;
            double cd = baseCd * Math.Pow(factor, BreakpointsPassed(level, breakpoints));
            return cd < min ? min : cd;
        }

        public static BigNumber HitDamage(int level, double baseHit, double damagePerLevel,
                                          int[] milestoneLevels, double[] milestoneMults)
        {
            if (level <= 0) return BigNumber.Zero;
            var dmg = new BigNumber(baseHit) * new BigNumber(damagePerLevel).Pow(level - 1);
            return dmg * MilestoneMultiplier(level, milestoneLevels, milestoneMults);
        }

        public static BigNumber EffectiveDps(int level, double baseHit, double baseCd,
                                             double damagePerLevel,
                                             int[] breakpoints, double factor, double min,
                                             int[] milestoneLevels, double[] milestoneMults)
        {
            if (level <= 0) return BigNumber.Zero;
            var hit = HitDamage(level, baseHit, damagePerLevel, milestoneLevels, milestoneMults);
            double cd = Cooldown(level, baseCd, breakpoints, factor, min);
            return hit / new BigNumber(cd);
        }
    }
}
