using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;
using StellarBreaker.Persistence;

namespace StellarBreaker.Tests
{
    public class DailyRewardWiringTests
    {
        const long Day = 86400;

        BalanceConfig _cfg;
        FakePlanetProvider _p1, _p2;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _p1 = new FakePlanetProvider();
            _p2 = new FakePlanetProvider();
        }

        [TearDown]
        public void TearDown()
        {
            _p1.Cleanup(); _p2.Cleanup();
            Object.DestroyImmediate(_cfg);
        }

        // ── Reward table ─────────────────────────────────────────────
        [Test]
        public void DayInCycle_Loops_After_Day_7()
        {
            Assert.AreEqual(1, DailyRewardTable.DayInCycle(1));
            Assert.AreEqual(7, DailyRewardTable.DayInCycle(7));
            Assert.AreEqual(1, DailyRewardTable.DayInCycle(8));   // loops
            Assert.AreEqual(3, DailyRewardTable.DayInCycle(10));  // 10 → day 3
        }

        [Test]
        public void GoldFor_Increases_Modestly_Across_The_Week()
        {
            var oneKill = new BigNumber(10.0);
            double prev = 0;
            for (int streak = 1; streak <= 7; streak++)
            {
                double g = DailyRewardTable.GoldFor(streak, oneKill, _cfg).ToDouble();
                Assert.Greater(g, prev, "day " + streak + " should pay more than the previous day");
                prev = g;
            }
        }

        [Test]
        public void Only_Day7_Grants_Relic()
        {
            for (int streak = 1; streak <= 6; streak++)
                Assert.IsFalse(DailyRewardTable.GrantsRelic(streak, _cfg), "streak " + streak);
            Assert.IsTrue(DailyRewardTable.GrantsRelic(7, _cfg));
            Assert.IsTrue(DailyRewardTable.GrantsRelic(14, _cfg));  // loops back to day 7 again
        }

        // ── GameSession wiring ──────────────────────────────────────
        [Test]
        public void Claim_Grants_Gold_And_Advances_Streak()
        {
            var s = new GameSession(_p1, _cfg, 1);
            s.Begin();

            var before = s.Wallet.Stardust;
            var result = s.ClaimDaily(0);

            Assert.IsTrue(result.canClaim);
            Assert.AreEqual(1, result.day);
            Assert.That(s.Wallet.Stardust.ToDouble(), Is.EqualTo((before + result.gold).ToDouble()).Within(1e-6));
            Assert.AreEqual(1, s.Daily.Streak);
        }

        [Test]
        public void Second_Claim_Same_Day_Is_NoOp()
        {
            var s = new GameSession(_p1, _cfg, 1);
            s.Begin();

            s.ClaimDaily(0);
            var wallet1 = s.Wallet.Stardust;
            var again = s.ClaimDaily(100);   // same UTC day

            Assert.IsFalse(again.canClaim);
            Assert.That(s.Wallet.Stardust.IsClose(wallet1));
        }

        [Test]
        public void Relic_Only_Granted_On_Day7_And_Only_If_Prestige_Unlocked()
        {
            var s = new GameSession(_p1, _cfg, 1);   // stage 1 → prestige NOT unlocked
            s.Begin();

            long t = 0;
            for (int i = 0; i < 6; i++) { s.ClaimDaily(t); t += Day; }   // days 1..6
            var day7 = s.ClaimDaily(t);                                  // day 7
            Assert.AreEqual(7, day7.day);
            Assert.IsFalse(day7.relic, "prestige not unlocked yet → no relic even on day 7");
            Assert.That(s.Prestige.Relics.Stardust.IsClose(BigNumber.Zero));
        }

        [Test]
        public void Relic_Granted_On_Day7_When_Prestige_Unlocked()
        {
            var s = new GameSession(_p1, _cfg, _cfg.prestigeUnlockStage);   // HighestStage ≥ unlock
            s.Begin();

            long t = 0;
            for (int i = 0; i < 6; i++) { s.ClaimDaily(t); t += Day; }
            var day7 = s.ClaimDaily(t);

            Assert.IsTrue(day7.relic);
            Assert.That(s.Prestige.Relics.Stardust.ToDouble(), Is.EqualTo(1.0).Within(1e-9));
        }

        // ── Save/load ────────────────────────────────────────────────
        [Test]
        public void Daily_Streak_Persists_Through_Save_Load()
        {
            var a = new GameSession(_p1, _cfg, 1);
            a.Begin();
            a.ClaimDaily(0);
            a.ClaimDaily(Day);   // streak 2

            var svc = new SaveService(new InMemorySaveStore());
            svc.Save(SaveBinder.Capture(a));
            Assert.IsTrue(svc.TryLoad(out var loaded));
            Assert.AreEqual(2, loaded.dailyStreak);
            Assert.Greater(loaded.lastDailyClaimUnixSeconds, 0);

            var b = new GameSession(_p2, _cfg, 1);
            SaveBinder.Apply(b, loaded);

            Assert.AreEqual(2, b.Daily.Streak);
            Assert.IsFalse(b.Daily.CanClaim(Day + 100));      // still "today" relative to last claim
            Assert.IsTrue(b.Daily.CanClaim(2 * Day + 100));   // next day → claimable, continues streak
            Assert.AreEqual(3, b.Daily.PreviewStreak(2 * Day + 100));
        }

        [Test]
        public void Fresh_Save_Has_No_Daily_Claim_Recorded()
        {
            var a = new GameSession(_p1, _cfg, 1);
            a.Begin();   // never claims daily

            var st = SaveBinder.Capture(a);
            Assert.AreEqual(0, st.lastDailyClaimUnixSeconds);
            Assert.AreEqual(0, st.dailyStreak);

            var b = new GameSession(_p2, _cfg, 1);
            SaveBinder.Apply(b, st);
            Assert.IsTrue(b.Daily.CanClaim(12345));   // untouched fresh service, still claimable
        }
    }
}
