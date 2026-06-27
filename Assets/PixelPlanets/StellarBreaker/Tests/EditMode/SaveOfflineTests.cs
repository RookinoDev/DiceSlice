using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Persistence;

namespace StellarBreaker.Tests
{
    public class SaveOfflineTests
    {
        [Test]
        public void BigNumberData_RoundTrips_Through_Json()
        {
            var original = new BigNumber(1.2345, 30);
            string json = JsonUtility.ToJson(BigNumberData.From(original));
            var back = JsonUtility.FromJson<BigNumberData>(json).To();
            Assert.That(back.IsClose(original, 1e-9));
        }

        [Test]
        public void SaveState_RoundTrips_Including_BigNumbers()
        {
            var store = new InMemorySaveStore();
            var svc = new SaveService(store);

            var state = new SaveState
            {
                stardust       = BigNumberData.From(new BigNumber(9.99, 42)),
                relics         = BigNumberData.From(new BigNumber(123.0)),
                tapLevel       = 17,
                shipLevels     = new[] { 3, 0, 9 },
                artifactLevels = new[] { 2, 1, 0 },
                currentStage   = 23,
                highestStage   = 40,
            };

            svc.Save(state);
            Assert.IsTrue(svc.TryLoad(out var loaded));

            Assert.That(loaded.stardust.To().IsClose(new BigNumber(9.99, 42), 1e-6));
            Assert.That(loaded.relics.To().IsClose(new BigNumber(123.0)));
            Assert.AreEqual(17, loaded.tapLevel);
            CollectionAssert.AreEqual(new[] { 3, 0, 9 }, loaded.shipLevels);
            CollectionAssert.AreEqual(new[] { 2, 1, 0 }, loaded.artifactLevels);
            Assert.AreEqual(23, loaded.currentStage);
            Assert.AreEqual(40, loaded.highestStage);
            Assert.Greater(loaded.lastSaveUnixSeconds, 0);
        }

        [Test]
        public void Load_Returns_False_When_Empty()
        {
            var svc = new SaveService(new InMemorySaveStore());
            Assert.IsFalse(svc.TryLoad(out _));
        }

        [Test]
        public void Offline_Earnings_Scale_With_Time_Below_Cap()
        {
            var income = new BigNumber(10.0); // per second
            var r = OfflineEarnings.Compute(100, income, rate: 0.5, capSeconds: 28800);
            Assert.That(r.ToDouble(), Is.EqualTo(10.0 * 100 * 0.5).Within(1e-6)); // 500
        }

        [Test]
        public void Offline_Earnings_Capped()
        {
            var income = new BigNumber(10.0);
            var r = OfflineEarnings.Compute(1_000_000, income, rate: 0.5, capSeconds: 28800);
            Assert.That(r.ToDouble(), Is.EqualTo(10.0 * 28800 * 0.5).Within(1e-3)); // 144000
        }

        [Test]
        public void Offline_From_Config_Uses_Rate_And_Cap()
        {
            var cfg = ScriptableObject.CreateInstance<BalanceConfig>(); // rate 0.5, cap 8h
            try
            {
                var income = new BigNumber(4.0);
                long last = 0, now = 3600;       // 1 hour
                var r = OfflineEarnings.FromConfig(last, now, income, cfg);
                Assert.That(r.ToDouble(), Is.EqualTo(4.0 * 3600 * 0.5).Within(1e-3)); // 7200
            }
            finally { Object.DestroyImmediate(cfg); }
        }
    }
}
