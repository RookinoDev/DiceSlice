namespace StellarBreaker.Monetization
{
    /// <summary>
    /// Daily reward with streak. A "day" is the UTC unix-day index (unix / 86400).
    /// Claiming consecutive days increases the streak; a gap resets it to 1.
    /// </summary>
    public class DailyRewardService
    {
        const long SecondsPerDay = 86400;

        public long LastClaimDay { get; private set; } = long.MinValue;
        public int  Streak       { get; private set; }

        public DailyRewardService() { }
        public DailyRewardService(long lastClaimDay, int streak)
        {
            LastClaimDay = lastClaimDay;
            Streak       = streak;
        }

        static long DayIndex(long unixSeconds) => unixSeconds / SecondsPerDay;

        public bool CanClaim(long nowUnix) => DayIndex(nowUnix) != LastClaimDay;

        /// <summary>Claim today's reward. Returns the new streak (0 if already claimed today).</summary>
        public int Claim(long nowUnix)
        {
            long day = DayIndex(nowUnix);
            if (day == LastClaimDay) return 0;          // already claimed today

            Streak       = (LastClaimDay != long.MinValue && day == LastClaimDay + 1) ? Streak + 1 : 1;
            LastClaimDay = day;
            return Streak;
        }
    }

    /// <summary>One resettable daily quest (e.g. destroy N planets).</summary>
    public class DailyQuestService
    {
        const long SecondsPerDay = 86400;

        public int  Target   { get; }
        public int  Progress { get; private set; }
        public bool Claimed  { get; private set; }
        long _day = long.MinValue;

        public DailyQuestService(int target) => Target = target;

        public void EnsureDaily(long nowUnix)
        {
            long d = nowUnix / SecondsPerDay;
            if (d != _day) { _day = d; Progress = 0; Claimed = false; }
        }

        public void Report(int amount) => Progress += amount;
        public bool IsComplete => Progress >= Target;

        public bool TryClaim()
        {
            if (!IsComplete || Claimed) return false;
            Claimed = true;
            return true;
        }
    }
}
