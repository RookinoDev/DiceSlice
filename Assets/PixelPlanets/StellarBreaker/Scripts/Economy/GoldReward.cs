using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Stardust awarded for destroying a planet.
    ///   gold(stage) = base × growth^(stage-1); bosses × bossMultiplier.
    /// </summary>
    public static class GoldReward
    {
        public static BigNumber ForStage(int stage, double baseGold, double growth)
        {
            int steps = stage - 1;
            if (steps <= 0) return new BigNumber(baseGold);
            return new BigNumber(baseGold) * new BigNumber(growth).Pow(steps);
        }

        public static BigNumber ForPlanet(Planet planet, BalanceConfig cfg)
        {
            var gold = ForStage(planet.Stage, cfg.goldBase, cfg.goldGrowth);
            if (planet.IsBoss) gold = gold * new BigNumber(cfg.bossGoldMultiplier);
            return gold;
        }
    }
}
