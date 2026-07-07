using System;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;
using StellarBreaker.Economy;

namespace StellarBreaker.Tests
{
    public class GoldRewardTests
    {
        BalanceConfig _cfg;

        [SetUp]    public void SetUp()    => _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
        [TearDown] public void TearDown() => UnityEngine.Object.DestroyImmediate(_cfg);

        [Test]
        public void Stage1_Is_Base_Gold()
        {
            Assert.That(GoldReward.ForStage(1, _cfg.goldBase, _cfg.goldGrowth).ToDouble(),
                        Is.EqualTo(5.0).Within(1e-9));
        }

        [Test]
        public void Stage_Follows_Growth()
        {
            double expected = 5.0 * Math.Pow(1.15, 4); // stage 5
            Assert.That(GoldReward.ForStage(5, _cfg.goldBase, _cfg.goldGrowth).ToDouble(),
                        Is.EqualTo(expected).Within(expected * 1e-6));
        }

        [Test]
        public void ForPlanet_Normal_Uses_Stage_Gold()
        {
            var planet = Planet.Create(3, _cfg);
            double expected = 5.0 * Math.Pow(1.15, 2);
            Assert.That(GoldReward.ForPlanet(planet, _cfg).ToDouble(),
                        Is.EqualTo(expected).Within(expected * 1e-6));
        }

        [Test]
        public void ForPlanet_Boss_Applies_BossMultiplier()
        {
            var boss = Planet.CreateBoss(3, _cfg, 7); // HP mult 7 is irrelevant to gold
            double expected = 5.0 * Math.Pow(1.15, 2) * _cfg.bossGoldMultiplier;
            Assert.That(GoldReward.ForPlanet(boss, _cfg).ToDouble(),
                        Is.EqualTo(expected).Within(expected * 1e-6));
        }
    }
}
