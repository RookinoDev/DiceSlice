using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Exponential, infinite upgrade cost: cost(level) = base × growth^(level-1),
    /// where `level` is the CURRENT level (cost to go level → level+1).
    /// </summary>
    public static class UpgradeCost
    {
        public static BigNumber Exponential(int currentLevel, double baseCost, double growth)
        {
            int steps = currentLevel - 1;
            if (steps <= 0) return new BigNumber(baseCost);
            return new BigNumber(baseCost) * new BigNumber(growth).Pow(steps);
        }

        public static BigNumber TapDamage(int currentLevel, BalanceConfig cfg)
            => Exponential(currentLevel, cfg.tapUpgradeBaseCost, cfg.tapUpgradeCostGrowth);

        /// <summary>
        /// Cumulative cost to OWN + upgrade to `level` (sum of levels 1..level):
        ///   base × (growth^level − 1) / (growth − 1).
        /// </summary>
        public static BigNumber CumulativeTo(int level, double baseCost, double growth)
        {
            if (level <= 0) return BigNumber.Zero;
            var numerator   = new BigNumber(growth).Pow(level) - BigNumber.One;
            var denominator = new BigNumber(growth - 1.0);
            return new BigNumber(baseCost) * numerator / denominator;
        }
    }
}
