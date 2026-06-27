using System;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;
using StellarBreaker.Economy;

namespace StellarBreaker.Tests
{
    public class PlanetTests
    {
        BalanceConfig _cfg;

        [SetUp]    public void SetUp()    => _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
        [TearDown] public void TearDown() => UnityEngine.Object.DestroyImmediate(_cfg);

        static double RefHp(int stage) => 29.0 * Math.Pow(1.57, stage - 1);

        [TestCase(1)]
        [TestCase(5)]
        [TestCase(10)]
        [TestCase(20)]
        public void MaxHp_Matches_Reference_Formula(int stage)
        {
            var planet = Planet.Create(stage, _cfg);
            double expected = RefHp(stage);
            Assert.That(planet.MaxHP.ToDouble(), Is.EqualTo(expected).Within(expected * 1e-6));
        }

        [Test]
        public void Stage1_Is_Base_29()
        {
            Assert.That(Planet.Create(1, _cfg).MaxHP.ToDouble(), Is.EqualTo(29.0).Within(1e-6));
        }

        [Test]
        public void Boss_Hp_Is_Enemy_Times_Multiplier()
        {
            var boss = Planet.CreateBoss(5, _cfg, 7);
            double expected = RefHp(5) * 7;
            Assert.That(boss.MaxHP.ToDouble(), Is.EqualTo(expected).Within(expected * 1e-6));
            Assert.IsTrue(boss.IsBoss);
        }

        [Test]
        public void ApplyDamage_Partial_Reduces_Hp_Without_Death()
        {
            var planet = Planet.Create(1, _cfg); // 29 HP
            bool fired = false;
            planet.OnDestroyed += _ => fired = true;

            planet.ApplyDamage(new BigNumber(10.0));

            Assert.IsFalse(planet.IsDead);
            Assert.IsFalse(fired);
            Assert.That(planet.CurrentHP.ToDouble(), Is.EqualTo(19.0).Within(1e-6));
            Assert.That(planet.HpFraction01(), Is.EqualTo(19.0 / 29.0).Within(1e-6));
        }

        [Test]
        public void ApplyDamage_Lethal_Drains_To_Zero_And_Fires_Once()
        {
            var planet = Planet.Create(3, _cfg);
            int fireCount = 0;
            planet.OnDestroyed += _ => fireCount++;

            planet.ApplyDamage(new BigNumber(1.0, 9)); // 1e9 ≫ HP

            Assert.IsTrue(planet.IsDead);
            Assert.AreEqual(1, fireCount);
            Assert.That(planet.CurrentHP.IsClose(BigNumber.Zero));
            Assert.That(planet.HpFraction01(), Is.EqualTo(0.0).Within(1e-9));
        }

        [Test]
        public void ApplyDamage_After_Death_Is_NoOp()
        {
            var planet = Planet.Create(1, _cfg);
            int fireCount = 0;
            planet.OnDestroyed += _ => fireCount++;

            planet.ApplyDamage(new BigNumber(1.0, 6));
            planet.ApplyDamage(new BigNumber(1.0, 6)); // already dead

            Assert.AreEqual(1, fireCount);
            Assert.IsTrue(planet.IsDead);
        }

        [Test]
        public void Exact_Lethal_Damage_Kills()
        {
            var planet = Planet.Create(1, _cfg); // 29
            bool fired = false;
            planet.OnDestroyed += _ => fired = true;

            planet.ApplyDamage(new BigNumber(29.0));

            Assert.IsTrue(planet.IsDead);
            Assert.IsTrue(fired);
        }
    }
}
