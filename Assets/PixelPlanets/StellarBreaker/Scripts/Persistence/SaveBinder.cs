using System;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Persistence
{
    /// <summary>Maps GameSession ⇆ SaveState. Boss state is intentionally not saved
    /// (a boss stage restarts cleanly on load).</summary>
    public static class SaveBinder
    {
        public static SaveState Capture(GameSession s)
        {
            var st = new SaveState
            {
                stardust     = BigNumberData.From(s.Wallet.Stardust),
                relics       = BigNumberData.From(s.Prestige.Relics.Stardust),
                tapLevel     = s.TapUpgrade.Level,
                shipLevels   = CaptureShipLevels(s.Ships),
                artifactLevels = CaptureArtifactLevels(s.Artifacts),
                currentStage = s.Stage.CurrentStage,
                highestStage = s.Stage.HighestStage,
            };
            return st;
        }

        public static void Apply(GameSession s, SaveState st)
        {
            if (st == null) return;
            s.Stage.RestoreProgress(st.currentStage, st.highestStage);  // before Begin()
            s.Wallet.Set(st.stardust.To());
            s.Prestige.Relics.Set(st.relics.To());
            s.TapUpgrade.Reset(Math.Max(1, st.tapLevel));
            s.Ships.RestoreLevels(st.shipLevels);
            s.Artifacts.RestoreLevels(st.artifactLevels);
        }

        static int[] CaptureShipLevels(ShipService ships)
        {
            var arr = new int[ships.Count];
            for (int i = 0; i < ships.Count; i++) arr[i] = ships.LevelOf(i);
            return arr;
        }

        static int[] CaptureArtifactLevels(ArtifactService arts)
        {
            var arr = new int[arts.Count];
            for (int i = 0; i < arts.Count; i++) arr[i] = arts.LevelOf(i);
            return arr;
        }
    }
}
