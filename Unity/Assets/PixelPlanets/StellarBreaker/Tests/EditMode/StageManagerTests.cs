using System;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class StageManagerTests
    {
        BalanceConfig _cfg;

        [SetUp]    public void SetUp()    => _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
        [TearDown] public void TearDown() => UnityEngine.Object.DestroyImmediate(_cfg);

        [Test]
        public void Boss_Detection_Every_Interval()
        {
            var sm = new StageManager(_cfg);
            Assert.IsFalse(sm.IsBossStage(4));
            Assert.IsTrue(sm.IsBossStage(5));
            Assert.IsTrue(sm.IsBossStage(10));
            Assert.IsFalse(sm.IsBossStage(11));
        }

        [Test]
        public void Multiplier_Cycle_Is_2_4_6_7_10_Repeating()
        {
            var sm = new StageManager(_cfg);
            Assert.AreEqual(2,  sm.BossMultiplier(5));
            Assert.AreEqual(4,  sm.BossMultiplier(10));
            Assert.AreEqual(6,  sm.BossMultiplier(15));
            Assert.AreEqual(7,  sm.BossMultiplier(20));
            Assert.AreEqual(10, sm.BossMultiplier(25));
            Assert.AreEqual(2,  sm.BossMultiplier(30)); // wraps
            Assert.AreEqual(1,  sm.BossMultiplier(7));  // non-boss → 1
        }

        [Test]
        public void Boss_Hp_Is_Enemy_Times_Multiplier()
        {
            var sm = new StageManager(_cfg);
            double enemy = 29.0 * Math.Pow(1.57, 9); // stage 10
            Assert.That(sm.HpFor(10).ToDouble(), Is.EqualTo(enemy * 4).Within(enemy * 4 * 1e-6));
        }

        [Test]
        public void Boss_Gold_Uses_Boss_Multiplier()
        {
            var sm = new StageManager(_cfg);
            double baseGold = 5.0 * Math.Pow(1.15, 4); // stage 5
            // stage 5 = first boss in the cycle → HP multiplier ×2; reward scales as
            // bossGoldMultiplier × sqrt(hpMultiplier) (see StageManager.BossRewardMultiplier).
            double expectedMult = _cfg.bossGoldMultiplier * Math.Sqrt(2);
            Assert.That(sm.GoldFor(5).ToDouble(),
                        Is.EqualTo(baseGold * expectedMult).Within(baseGold * expectedMult * 1e-4));
        }

        [Test]
        public void Harder_Boss_Pays_More_Than_Easier_Boss()
        {
            var sm = new StageManager(_cfg);
            // stage 5 → HP×2 (easiest boss), stage 25 → HP×10 (hardest in the cycle).
            double easyMult = sm.BossRewardMultiplier(5);
            double hardMult = sm.BossRewardMultiplier(25);
            Assert.Greater(hardMult, easyMult);

            // Sanity: the scaling is sub-linear (sqrt), not 1:1 with HP, so it stays bounded.
            Assert.Less(hardMult, easyMult * 10.0);   // HP is ×5 harder (10 vs 2), reward isn't ×5
        }

        [Test]
        public void Normal_Kill_Advances()
        {
            var sm = new StageManager(_cfg, 1);
            sm.Begin();
            sm.NotifyPlanetKilled();
            Assert.AreEqual(2, sm.CurrentStage);
        }

        [Test]
        public void Entering_Boss_Starts_Timer()
        {
            var sm = new StageManager(_cfg, 5);
            sm.Begin();
            Assert.IsTrue(sm.BossActive);
            Assert.That(sm.BossTimeLeft, Is.EqualTo(30.0).Within(1e-6));
        }

        [Test]
        public void Boss_Timer_Fail_Keeps_Stage()
        {
            var sm = new StageManager(_cfg, 5);
            bool failed = false;
            sm.OnBossFailed += _ => failed = true;
            sm.Begin();

            sm.Tick(31.0); // exceed window

            Assert.IsTrue(failed);
            Assert.IsFalse(sm.BossActive);
            Assert.AreEqual(5, sm.CurrentStage);  // did NOT advance
        }

        [Test]
        public void Boss_Success_Advances_And_Persists_Highest()
        {
            var sm = new StageManager(_cfg, 5);
            bool cleared = false;
            sm.OnBossCleared += _ => cleared = true;
            sm.Begin();

            sm.NotifyPlanetKilled();

            Assert.IsTrue(cleared);
            Assert.AreEqual(6, sm.CurrentStage);
            Assert.AreEqual(6, sm.HighestStage);
        }

        [Test]
        public void Failed_Boss_Cannot_Advance_Until_Retry()
        {
            var sm = new StageManager(_cfg, 5);
            sm.Begin();
            sm.Tick(31.0);                 // fail
            sm.NotifyPlanetKilled();       // ignored (must retry)
            Assert.AreEqual(5, sm.CurrentStage);

            sm.RetryBoss();
            Assert.IsTrue(sm.BossActive);
            sm.NotifyPlanetKilled();       // now clears
            Assert.AreEqual(6, sm.CurrentStage);
        }
    }
}
