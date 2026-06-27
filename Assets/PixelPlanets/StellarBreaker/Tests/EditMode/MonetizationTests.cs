using NUnit.Framework;
using StellarBreaker.Monetization;

namespace StellarBreaker.Tests
{
    public class MonetizationTests
    {
        const long Day = 86400;

        // ── Boosts ───────────────────────────────────────────────────
        [Test]
        public void Temporary_Boost_Multiplies_Then_Expires()
        {
            var b = new BoostService();
            Assert.That(b.Multiplier(BoostTarget.AllDamage), Is.EqualTo(1.0).Within(1e-9));

            b.AddTemporary(BoostTarget.AllDamage, 2.0, 30);
            Assert.That(b.Multiplier(BoostTarget.AllDamage), Is.EqualTo(2.0).Within(1e-9));

            b.Tick(31);
            Assert.That(b.Multiplier(BoostTarget.AllDamage), Is.EqualTo(1.0).Within(1e-9));
            Assert.IsFalse(b.HasTemporary(BoostTarget.AllDamage));
        }

        [Test]
        public void Temporary_Boosts_Stack_Multiplicatively()
        {
            var b = new BoostService();
            b.AddTemporary(BoostTarget.Gold, 2.0, 30);
            b.AddTemporary(BoostTarget.Gold, 3.0, 30);
            Assert.That(b.Multiplier(BoostTarget.Gold), Is.EqualTo(6.0).Within(1e-9));
        }

        [Test]
        public void Permanent_Boost_Survives_Prestige()
        {
            var b = new BoostService();
            b.AddPermanent(BoostTarget.AllDamage, 2.0);   // IAP permanent ×2
            b.AddTemporary(BoostTarget.AllDamage, 3.0, 30); // ad boost ×3
            Assert.That(b.Multiplier(BoostTarget.AllDamage), Is.EqualTo(6.0).Within(1e-9));

            b.OnPrestige();   // clears temporaries, keeps permanent
            Assert.That(b.Multiplier(BoostTarget.AllDamage), Is.EqualTo(2.0).Within(1e-9));
        }

        // ── Daily rewards ────────────────────────────────────────────
        [Test]
        public void Daily_Claim_Once_Per_Day_With_Streak()
        {
            var d = new DailyRewardService();

            Assert.IsTrue(d.CanClaim(0));
            Assert.AreEqual(1, d.Claim(0));          // day 0 → streak 1
            Assert.IsFalse(d.CanClaim(100));         // same day
            Assert.AreEqual(0, d.Claim(200));        // already claimed → 0

            Assert.AreEqual(2, d.Claim(Day));        // next day → streak 2
            Assert.AreEqual(3, d.Claim(2 * Day));    // consecutive → streak 3
        }

        [Test]
        public void Daily_Streak_Resets_After_Gap()
        {
            var d = new DailyRewardService();
            d.Claim(0);            // streak 1
            d.Claim(Day);          // streak 2
            int s = d.Claim(3 * Day); // skipped day 2 → reset
            Assert.AreEqual(1, s);
        }

        // ── Daily quest ──────────────────────────────────────────────
        [Test]
        public void Daily_Quest_Completes_Claims_And_Resets()
        {
            var q = new DailyQuestService(target: 5);
            q.EnsureDaily(0);

            q.Report(3);
            Assert.IsFalse(q.IsComplete);
            Assert.IsFalse(q.TryClaim());

            q.Report(2);
            Assert.IsTrue(q.IsComplete);
            Assert.IsTrue(q.TryClaim());
            Assert.IsFalse(q.TryClaim());            // can't double-claim

            q.EnsureDaily(Day);                      // new day → reset
            Assert.AreEqual(0, q.Progress);
            Assert.IsFalse(q.Claimed);
        }

        // ── Null SDK stubs ───────────────────────────────────────────
        [Test]
        public void Null_Ads_Skip_And_Null_Iap_Fails_Gracefully()
        {
            IRewardedAds ads = new NullRewardedAds();
            bool rewarded = false, skipped = false;
            ads.Show(() => rewarded = true, () => skipped = true);
            Assert.IsFalse(rewarded);
            Assert.IsTrue(skipped);

            IIapService iap = new NullIapService();
            bool ok = true;
            iap.Purchase("starter_pack", success => ok = success);
            Assert.IsFalse(ok);
            Assert.IsFalse(iap.IsOwned("starter_pack"));
        }
    }
}
