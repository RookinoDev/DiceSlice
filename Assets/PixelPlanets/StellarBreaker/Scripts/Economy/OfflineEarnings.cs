using System;
using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Offline reward from a timestamp delta: incomePerSecond × min(elapsed, cap) × rate.
    /// </summary>
    public static class OfflineEarnings
    {
        public static double CappedSeconds(long lastUnix, long nowUnix, double capSeconds)
        {
            double elapsed = nowUnix - lastUnix;
            if (elapsed < 0) elapsed = 0;
            return Math.Min(elapsed, capSeconds);
        }

        public static BigNumber Compute(double elapsedSeconds, BigNumber incomePerSecond,
                                        double rate, double capSeconds)
        {
            double secs = Math.Min(Math.Max(0, elapsedSeconds), capSeconds);
            return incomePerSecond * new BigNumber(secs * rate);
        }

        public static BigNumber FromConfig(long lastUnix, long nowUnix,
                                           BigNumber incomePerSecond, BalanceConfig cfg)
        {
            double cap  = cfg.offlineCapHours * 3600.0;
            double secs = CappedSeconds(lastUnix, nowUnix, cap);
            return incomePerSecond * new BigNumber(secs * cfg.offlineRate);
        }
    }
}
