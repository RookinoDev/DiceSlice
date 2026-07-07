using StellarBreaker.Core;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Estimates Stardust earned per second from idle combat:
    ///   kills/sec ≈ fleetDPS / enemyHP ;  income/sec = kills/sec × goldPerKill.
    /// Returns 0 if there is no passive DPS (idle needs ships).
    /// </summary>
    public static class OfflineIncome
    {
        public static BigNumber PerSecond(BigNumber fleetDps, BigNumber enemyHp, BigNumber goldPerKill)
        {
            if (fleetDps <= BigNumber.Zero || enemyHp <= BigNumber.Zero) return BigNumber.Zero;
            return (fleetDps / enemyHp) * goldPerKill;
        }
    }
}
