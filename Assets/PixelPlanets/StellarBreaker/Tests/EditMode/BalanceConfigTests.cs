using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Config;

namespace StellarBreaker.Tests
{
    public class BalanceConfigTests
    {
        BalanceConfig _cfg;

        [SetUp]
        public void SetUp() => _cfg = ScriptableObject.CreateInstance<BalanceConfig>();

        [TearDown]
        public void TearDown() => Object.DestroyImmediate(_cfg);

        [Test]
        public void Loads_With_Datasheet_Defaults()
        {
            Assert.That(_cfg.enemyHpBase,   Is.EqualTo(29.0).Within(1e-9));
            Assert.That(_cfg.enemyHpGrowth, Is.EqualTo(1.57).Within(1e-9));
            Assert.That(_cfg.tapDamageBase, Is.EqualTo(1.05).Within(1e-9));
            Assert.That(_cfg.shipBaseCost,  Is.EqualTo(50.0).Within(1e-9));
            Assert.That(_cfg.shipCostPerLevel, Is.EqualTo(1.075).Within(1e-9));
            Assert.AreEqual(19, _cfg.shipCount);
            Assert.That(_cfg.skillDurationSeconds, Is.EqualTo(30f).Within(1e-4f));
        }

        [Test]
        public void Boss_Multiplier_Cycle_Is_Correct()
        {
            CollectionAssert.AreEqual(new[] { 2, 4, 6, 7, 10 }, _cfg.bossMultipliers);
        }

        [Test]
        public void Skill_Unlock_Levels_Are_Correct()
        {
            CollectionAssert.AreEqual(new[] { 50, 100, 200, 300, 400, 500 }, _cfg.skillUnlockLevels);
        }

        [Test]
        public void Ship_BaseCost_Growth_Range_Is_Sane()
        {
            Assert.That(_cfg.shipBaseCostGrowthMin, Is.EqualTo(3.5).Within(1e-9));
            Assert.That(_cfg.shipBaseCostGrowthMax, Is.EqualTo(8.9).Within(1e-9));
            Assert.Less(_cfg.shipBaseCostGrowthMin, _cfg.shipBaseCostGrowthMax);
        }
    }
}
