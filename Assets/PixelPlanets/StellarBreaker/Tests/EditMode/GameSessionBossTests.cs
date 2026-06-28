using System;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    /// <summary>Boss flow through the unified StageManager authority inside GameSession.</summary>
    public class GameSessionBossTests
    {
        BalanceConfig _cfg;
        FakePlanetProvider _provider;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _provider = new FakePlanetProvider();
        }

        [TearDown]
        public void TearDown()
        {
            _provider.Cleanup();
            UnityEngine.Object.DestroyImmediate(_cfg);
        }

        [Test]
        public void Stage5_Is_A_Boss_With_Higher_Hp_And_Timer()
        {
            var s = new GameSession(_provider, _cfg, startStage: 5);
            s.Begin();

            Assert.IsTrue(s.Enemy.Current.IsBoss);
            Assert.IsTrue(s.Stage.BossActive);
            Assert.That(s.Stage.BossTimeLeft, Is.EqualTo(30.0).Within(1e-6));

            double normalHp = 29.0 * Math.Pow(1.57, 4);   // stage 5 base
            Assert.That(s.Enemy.Current.MaxHP.ToDouble(),
                        Is.EqualTo(normalHp * 2).Within(normalHp * 2 * 1e-6)); // ×2 boss mult
        }

        [Test]
        public void Boss_Cleared_Advances_And_Pays_Boss_Gold()
        {
            var s = new GameSession(_provider, _cfg, startStage: 5);
            BigNumber paid = BigNumber.Zero;
            s.OnReward += (p, g) => paid = g;
            s.Begin();

            s.Enemy.ApplyDamage(new BigNumber(1.0, 12)); // lethal within the window

            Assert.AreEqual(6, s.Stage.CurrentStage);
            Assert.IsFalse(s.Stage.BossActive);
            double bossGold = 5.0 * Math.Pow(1.15, 4) * _cfg.bossGoldMultiplier;
            Assert.That(paid.ToDouble(), Is.EqualTo(bossGold).Within(bossGold * 1e-4));
            Assert.That(s.Wallet.Stardust.ToDouble(), Is.EqualTo(bossGold).Within(bossGold * 1e-4));
        }

        [Test]
        public void Boss_Timer_Fail_Stays_On_Stage_And_Retries_At_Full_Hp()
        {
            var s = new GameSession(_provider, _cfg, startStage: 5);
            s.Begin();

            s.Tap();                 // chip a little damage
            Assert.Less(s.Enemy.Current.CurrentHP.ToDouble(), s.Enemy.Current.MaxHP.ToDouble());

            s.Tick(31.0);            // exceed the 30s window → fail → auto-retry

            Assert.AreEqual(5, s.Stage.CurrentStage);     // stayed on the boss stage
            Assert.IsTrue(s.Stage.BossActive);            // re-armed
            Assert.That(s.Stage.BossTimeLeft, Is.EqualTo(30.0).Within(1e-6));
            // fresh boss at full HP
            Assert.That(s.Enemy.Current.CurrentHP.IsClose(s.Enemy.Current.MaxHP, 1e-4));
        }

        [Test]
        public void Normal_Stages_Still_Advance_Without_Timer()
        {
            var s = new GameSession(_provider, _cfg, startStage: 1);
            s.Begin();
            Assert.IsFalse(s.Stage.BossActive);

            s.Enemy.ApplyDamage(new BigNumber(1.0, 9));   // kill stage 1
            Assert.AreEqual(2, s.Stage.CurrentStage);
            Assert.IsFalse(s.Enemy.Current.IsBoss);
        }
    }
}
