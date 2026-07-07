using System;

namespace StellarBreaker.Monetization
{
    /// <summary>Rewarded-ads hook. No real SDK — wire AdMob/Unity Ads later.</summary>
    public interface IRewardedAds
    {
        bool Available { get; }
        void Show(Action onReward, Action onSkipped = null);
    }

    /// <summary>IAP hook. No real SDK — wire to the store later.</summary>
    public interface IIapService
    {
        bool IsOwned(string productId);
        void Purchase(string productId, Action<bool> onComplete);
    }

    /// <summary>Leaderboard hook (no impl).</summary>
    public interface ILeaderboard
    {
        void SubmitHighestStage(int stage);
    }

    /// <summary>Clan hook (no impl).</summary>
    public interface IClanService
    {
        bool InClan { get; }
    }

    // ── Null stubs so the game runs without an SDK ──────────────────
    public class NullRewardedAds : IRewardedAds
    {
        public bool Available => false;
        public void Show(Action onReward, Action onSkipped = null) => onSkipped?.Invoke();
    }

    public class NullIapService : IIapService
    {
        public bool IsOwned(string productId) => false;
        public void Purchase(string productId, Action<bool> onComplete) => onComplete?.Invoke(false);
    }
}
