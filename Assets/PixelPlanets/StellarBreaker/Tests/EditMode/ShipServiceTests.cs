using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class ShipServiceTests
    {
        BalanceConfig _cfg;
        List<ShipDefinition> _ships;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _ships = new List<ShipDefinition>
            {
                ShipDefinition.Create("A", 100.0,  ShipArchetype.Fast,   0.5, 10.0), // baseHit 5,  10 DPS
                ShipDefinition.Create("B", 1000.0, ShipArchetype.Medium, 1.0, 50.0), // baseHit 50, 50 DPS
            };
        }

        [TearDown]
        public void TearDown()
        {
            foreach (var s in _ships) UnityEngine.Object.DestroyImmediate(s);
            UnityEngine.Object.DestroyImmediate(_cfg);
        }

        CurrencyService RichWallet()
        {
            var w = new CurrencyService();
            w.Add(new BigNumber(1.0, 9));
            return w;
        }

        // ── Cost (unchanged from the cost sheet) ─────────────────────
        [Test]
        public void Cost_Is_Base_And_Grows_By_1075()
        {
            var svc = new ShipService(_ships, _cfg);
            Assert.That(svc.NextCost(0).ToDouble(), Is.EqualTo(100.0).Within(1e-6));
            svc.BuyOrUpgrade(0, RichWallet());
            Assert.That(svc.NextCost(0).ToDouble(), Is.EqualTo(100.0 * 1.075).Within(1e-6));
        }

        [Test]
        public void Level_N_Cost_Matches_Formula()
        {
            var svc = new ShipService(_ships, _cfg);
            var wallet = RichWallet();
            for (int i = 0; i < 9; i++) svc.BuyOrUpgrade(0, wallet);
            double expected = 100.0 * Math.Pow(1.075, 9);
            Assert.That(svc.NextCost(0).ToDouble(), Is.EqualTo(expected).Within(expected * 1e-6));
        }

        [Test]
        public void Buy_Rejected_When_Broke()
        {
            var svc = new ShipService(_ships, _cfg);
            var poor = new CurrencyService();
            poor.Add(new BigNumber(50.0));
            Assert.IsFalse(svc.BuyOrUpgrade(0, poor));
            Assert.AreEqual(0, svc.LevelOf(0));
        }

        // ── DPS ──────────────────────────────────────────────────────
        [Test]
        public void Not_Owned_Has_Zero_Dps()
        {
            var svc = new ShipService(_ships, _cfg);
            Assert.That(svc.ShipDps(0).IsClose(BigNumber.Zero));
        }

        [Test]
        public void Level1_EffectiveDps_Equals_BaseDps()
        {
            var svc = new ShipService(_ships, _cfg);
            svc.BuyOrUpgrade(0, RichWallet());
            Assert.That(svc.ShipDps(0).ToDouble(), Is.EqualTo(10.0).Within(1e-6));
        }

        [Test]
        public void FleetDps_Sums_All_Ships()
        {
            var svc = new ShipService(_ships, _cfg);
            var w = RichWallet();
            svc.BuyOrUpgrade(0, w); // 10
            svc.BuyOrUpgrade(1, w); // 50
            Assert.That(svc.FleetDps().ToDouble(), Is.EqualTo(60.0).Within(1e-6));
        }

        [Test]
        public void ShipDps_Matches_Combat_Formula_With_Milestone()
        {
            var svc = new ShipService(_ships, _cfg);
            var w = RichWallet();
            for (int i = 0; i < 25; i++) svc.BuyOrUpgrade(0, w); // level 25 → first milestone ×2

            var expected = ShipCombat.EffectiveDps(25, _ships[0].baseHitDamage, _ships[0].baseCooldown,
                _cfg.shipDamagePerLevel, _cfg.shipCooldownBreakpoints, _cfg.shipCooldownFactor,
                _cfg.shipCooldownMin, _cfg.shipMilestoneLevels, _cfg.shipMilestoneMultipliers);
            Assert.That(svc.ShipDps(0).IsClose(expected, 1e-3));
        }

        // ── Cooldown-based idle damage ───────────────────────────────
        [Test]
        public void Tick_Fires_One_Hit_Per_Cooldown()
        {
            var provider = new FakePlanetProvider();
            try
            {
                var enemy = new EnemyController(provider, _cfg, 1);
                enemy.Begin();
                var svc = new ShipService(_ships, _cfg);
                svc.BuyOrUpgrade(0, RichWallet()); // A: cd 0.5, hit 5

                Assert.That(svc.Tick(0.25, enemy).IsClose(BigNumber.Zero));      // not enough yet
                Assert.That(svc.Tick(0.25, enemy).IsClose(new BigNumber(5.0), 1e-4)); // now one hit
            }
            finally { provider.Cleanup(); }
        }

        [Test]
        public void Idle_Ticks_Kill_Planet_Without_Tapping()
        {
            var provider = new FakePlanetProvider();
            try
            {
                var enemy = new EnemyController(provider, _cfg, 1);
                enemy.Begin();
                var svc = new ShipService(_ships, _cfg);
                svc.BuyOrUpgrade(0, RichWallet()); // 5 dmg / 0.5s, stage-1 HP 29

                for (int i = 0; i < 20 && enemy.Stage == 1; i++) svc.Tick(0.5, enemy);

                Assert.GreaterOrEqual(enemy.Stage, 2);
            }
            finally { provider.Cleanup(); }
        }

        [Test]
        public void OnShipHit_Reports_Hit_Damage()
        {
            var provider = new FakePlanetProvider();
            try
            {
                var enemy = new EnemyController(provider, _cfg, 1);
                enemy.Begin();
                var svc = new ShipService(_ships, _cfg);
                svc.BuyOrUpgrade(0, RichWallet());

                BigNumber? hit = null;
                svc.OnShipHit += (i, dmg) => hit = dmg;
                svc.Tick(0.5, enemy);

                Assert.IsTrue(hit.HasValue);
                Assert.That(hit.Value.IsClose(new BigNumber(5.0), 1e-4));
            }
            finally { provider.Cleanup(); }
        }
    }
}
