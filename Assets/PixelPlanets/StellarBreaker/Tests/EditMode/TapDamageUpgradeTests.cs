using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class TapDamageUpgradeTests
    {
        BalanceConfig _cfg;

        [SetUp]    public void SetUp()    => _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
        [TearDown] public void TearDown() => Object.DestroyImmediate(_cfg);

        [Test]
        public void Starts_At_Level1_With_Base_Cost_And_Damage()
        {
            var up = new TapDamageUpgrade(_cfg);
            Assert.AreEqual(1, up.Level);
            Assert.That(up.NextCost.ToDouble(),      Is.EqualTo(10.0).Within(1e-6));
            Assert.That(up.CurrentDamage.ToDouble(), Is.EqualTo(1.05).Within(1e-9));
        }

        [Test]
        public void Upgrade_Deducts_Cost_And_Levels_Up()
        {
            var up = new TapDamageUpgrade(_cfg);
            var wallet = new CurrencyService();
            wallet.Add(new BigNumber(100.0));

            double before = up.CurrentDamage.ToDouble();
            bool ok = up.TryUpgrade(wallet);

            Assert.IsTrue(ok);
            Assert.AreEqual(2, up.Level);
            Assert.That(wallet.Stardust.IsClose(new BigNumber(90.0)));     // 100 - 10
            Assert.Greater(up.CurrentDamage.ToDouble(), before);
            Assert.That(up.NextCost.ToDouble(), Is.EqualTo(10.0 * 1.12).Within(1e-6)); // 11.2
        }

        [Test]
        public void Upgrade_Rejected_When_Broke_NoChange()
        {
            var up = new TapDamageUpgrade(_cfg);
            var wallet = new CurrencyService();
            wallet.Add(new BigNumber(5.0)); // < 10

            bool ok = up.TryUpgrade(wallet);

            Assert.IsFalse(ok);
            Assert.AreEqual(1, up.Level);
            Assert.That(wallet.Stardust.IsClose(new BigNumber(5.0)));
        }

        [Test]
        public void Multiple_Upgrades_Raise_Cost_Exponentially()
        {
            var up = new TapDamageUpgrade(_cfg);
            var wallet = new CurrencyService();
            wallet.Add(new BigNumber(1.0, 6)); // plenty

            for (int i = 0; i < 5; i++) Assert.IsTrue(up.TryUpgrade(wallet));
            Assert.AreEqual(6, up.Level);
            // cost(level 6) = 10 × 1.12^5
            Assert.That(up.NextCost.ToDouble(),
                        Is.EqualTo(10.0 * System.Math.Pow(1.12, 5)).Within(1e-4));
        }
    }
}
