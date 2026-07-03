namespace StellarBreaker.Monetization
{
    /// <summary>
    /// Daily reward with streak. A "day" is the UTC unix-day index (unix / 86400).
    /// Claiming consecutive days increases the streak; a gap resets it to 1.
    /// </summary>
    public class DailyRewardService
    {
        public const long SecondsPerDay = 86400;

        public long LastClaimDay { get; private set; } = long.MinValue;
        public int  Streak       { get; private set; }

        public DailyRewardService() { }
        public DailyRewardService(long lastClaimDay, int streak)
        {
            LastClaimDay = lastClaimDay;
            Streak       = streak;
        }

        /// <summary>Restore persisted state (e.g. from a save). Does not validate — trusted caller.</summary>
        public void Restore(long lastClaimDay, int streak)
        {
            LastClaimDay = lastClaimDay;
            Streak       = streak;
        }

        static long DayIndex(long unixSeconds) => unixSeconds / SecondsPerDay;

        public bool CanClaim(long nowUnix) => DayIndex(nowUnix) != LastClaimDay;

        /// <summary>What the streak would become if claimed right now (whether or not it's actually claimable).</summary>
        public int PreviewStreak(long nowUnix)
        {
            long day = DayIndex(nowUnix);
            if (day == LastClaimDay) return Streak;      // already claimed today — stays the same
            return (LastClaimDay != long.MinValue && day == LastClaimDay + 1) ? Streak + 1 : 1;
        }

        /// <summary>Seconds remaining until the next UTC day boundary (next possible claim).</summary>
        public static long SecondsUntilNextDay(long nowUnix)
            => SecondsPerDay - (nowUnix % SecondsPerDay);

        /// <summary>Claim today's reward. Returns the new streak (0 if already claimed today).</summary>
        public int Claim(long nowUnix)
        {
            if (!CanClaim(nowUnix)) return 0;            // already claimed today
            Streak       = PreviewStreak(nowUnix);
            LastClaimDay = DayIndex(nowUnix);
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
