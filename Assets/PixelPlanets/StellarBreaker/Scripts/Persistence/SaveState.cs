using System;
using StellarBreaker.Core;

namespace StellarBreaker.Persistence
{
    /// <summary>Full serializable game state (BigNumbers stored as BigNumberData).</summary>
    [Serializable]
    public class SaveState
    {
        public int           version = 1;

        public BigNumberData  stardust;
        public BigNumberData  relics;
        public BigNumberData  antimatter;   // premium currency (Phase 10)

        public int            tapLevel       = 1;
        public int[]          shipLevels     = Array.Empty<int>();
        public int[]          artifactLevels = Array.Empty<int>();

        public int            currentStage   = 1;
        public int            highestStage    = 1;

        public long           lastSaveUnixSeconds;
        public long           lastDailyClaimUnixSeconds;
        public int            dailyStreak;
    }
}
