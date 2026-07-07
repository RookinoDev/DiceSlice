using System;
using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Maps a claim streak to a day-in-cycle (1..7, looping) and its reward. Gold is a
    /// multiple of "one kill's worth" at the player's current stage, so the reward always
    /// stays relevant regardless of how far progressed the player is.
    /// </summary>
    public static class DailyRewardTable
    {
        public const int CycleLength = 7;

        /// <summary>1..7, looping after day 7 (streak 8 = day 1 again, etc).</summary>
        public static int DayInCycle(int streak)
            => ((Math.Max(1, streak) - 1) % CycleLength) + 1;

        public static BigNumber GoldFor(int streak, BigNumber oneKillGold, BalanceConfig cfg)
        {
            int day = DayInCycle(streak);
            var table = cfg.dailyGoldKillMultiples;
            double mult = (table != null && table.Length >= day) ? table[day - 1] : (2.0 + day);
            return oneKillGold * new BigNumber(mult);
        }

        public static bool GrantsRelic(int streak, BalanceConfig cfg)
            => DayInCycle(streak) == cfg.dailyRelicDay;
    }
}
