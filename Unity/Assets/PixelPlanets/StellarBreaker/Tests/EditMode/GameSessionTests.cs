using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class GameSessionTests
    {
        BalanceConfig _cfg;
        FakePlanetProvider _provider;   // reused from EnemyControllerTests (same assembly)

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
            Object.DestroyImmediate(_cfg);
        }

        static void KillCurrent(GameSession s)
        {
            int stage = s.Enemy.Stage;
            int guard = 500000;
            while (s.Enemy.Stage == stage && guard-- > 0) s.Tap();
        }

        [Test]
        public void Tap_Reduces_Active_Planet_Hp_By_TapDamage()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();

            var max = s.Enemy.Current.MaxHP;
            var dmg = s.TapUpgrade.CurrentDamage;
            s.Tap();

            Assert.That(s.Enemy.Current.CurrentHP.IsClose(max - dmg, 1e-4));
        }

        [Test]
        public void OnDamageDealt_Fires_With_TapDamage()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();

            BigNumber? seen = null;
            s.Taps.OnDamageDealt += e => seen = e.Amount;

            s.Tap();
            Assert.IsTrue(seen.HasValue);
            Assert.That(seen.Value.IsClose(s.TapUpgrade.CurrentDamage));
        }

        [Test]
        public void Killing_Planet_Awards_Correct_Stardust()
        {
            var s = new GameSession(_provider, _cfg, 1);
            int rewards = 0;
            s.OnReward += (p, g) => rewards++;
            s.Begin();

            KillCurrent(s); // stage 1 → gold = base (5)

            Assert.AreEqual(1, rewards);
            Assert.That(s.Wallet.Stardust.IsClose(new BigNumber(5.0), 1e-4));
            Assert.AreEqual(2, s.Enemy.Stage);
        }

        [Test]
        public void Full_Loop_Tap_Kill_Earn_Upgrade()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();

            // Not enough after one kill (5 < 10): upgrade rejected.
            KillCurrent(s);
            Assert.IsFalse(s.UpgradeTapDamage());
            Assert.AreEqual(1, s.TapUpgrade.Level);

            // Second kill: 5 + 5×1.15 = 10.75 ≥ 10 → upgrade succeeds.
            KillCurrent(s);
            double before = s.TapUpgrade.CurrentDamage.ToDouble();

            Assert.IsTrue(s.UpgradeTapDamage());
            Assert.AreEqual(2, s.TapUpgrade.Level);
            Assert.Greater(s.TapUpgrade.CurrentDamage.ToDouble(), before);
            // 10.75 - 10 = 0.75 remaining
            Assert.That(s.Wallet.Stardust.IsClose(new BigNumber(0.75), 1e-4));
        }
    }
}
