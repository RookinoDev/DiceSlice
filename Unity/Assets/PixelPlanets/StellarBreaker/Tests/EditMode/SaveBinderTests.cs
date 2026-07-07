using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;
using StellarBreaker.Persistence;

namespace StellarBreaker.Tests
{
    public class SaveBinderTests
    {
        BalanceConfig _cfg;
        List<ShipDefinition> _ships;
        FakePlanetProvider _p1, _p2;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _ships = new List<ShipDefinition>
            {
                ShipDefinition.Create("A", 100, ShipArchetype.Fast,   0.5, 10),
                ShipDefinition.Create("B", 1000, ShipArchetype.Medium, 1.0, 50),
            };
            _p1 = new FakePlanetProvider();
            _p2 = new FakePlanetProvider();
        }

        [TearDown]
        public void TearDown()
        {
            _p1.Cleanup(); _p2.Cleanup();
            foreach (var s in _ships) Object.DestroyImmediate(s);
            Object.DestroyImmediate(_cfg);
        }

        [Test]
        public void Save_Load_Apply_RoundTrips_All_Fields()
        {
            var a = new GameSession(_p1, _cfg, 1, _ships);
            a.Begin();
            a.Wallet.Add(new BigNumber(1.0, 6));
            a.UpgradeTapDamage(); a.UpgradeTapDamage();   // tap level 3
            a.BuyShip(0);                                  // ship A level 1
            a.Enemy.ApplyDamage(new BigNumber(1.0, 9));    // kill → stage 2

            // Capture → save → load → apply onto a fresh session
            var store = new InMemorySaveStore();
            var svc = new SaveService(store);
            svc.Save(SaveBinder.Capture(a));
            Assert.IsTrue(svc.TryLoad(out var loaded));

            var b = new GameSession(_p2, _cfg, 1, _ships);
            SaveBinder.Apply(b, loaded);

            Assert.AreEqual(a.TapUpgrade.Level, b.TapUpgrade.Level);
            Assert.AreEqual(a.Ships.LevelOf(0), b.Ships.LevelOf(0));
            Assert.AreEqual(a.Stage.CurrentStage, b.Stage.CurrentStage);   // 2
            Assert.AreEqual(a.Stage.HighestStage, b.Stage.HighestStage);   // 2
            Assert.That(b.Wallet.Stardust.IsClose(a.Wallet.Stardust, 1e-4));

            b.Begin();   // spawns the restored stage cleanly
            Assert.AreEqual(2, b.Enemy.Current.Stage);
        }

        [Test]
        public void OfflineIncome_PerSecond_Is_Kills_Times_Gold()
        {
            var inc = OfflineIncome.PerSecond(new BigNumber(100.0), new BigNumber(50.0), new BigNumber(5.0));
            Assert.That(inc.ToDouble(), Is.EqualTo(10.0).Within(1e-9)); // (100/50)×5
        }

        [Test]
        public void OfflineIncome_Zero_Without_Dps()
        {
            var inc = OfflineIncome.PerSecond(BigNumber.Zero, new BigNumber(50.0), new BigNumber(5.0));
            Assert.That(inc.IsClose(BigNumber.Zero));
        }

        [Test]
        public void Offline_Earnings_Respect_Rate_And_Cap()
        {
            var income = new BigNumber(10.0);                 // /sec
            long last = 0, now = 3600;                         // 1 hour
            var r = OfflineEarnings.FromConfig(last, now, income, _cfg); // rate 0.5
            Assert.That(r.ToDouble(), Is.EqualTo(10.0 * 3600 * 0.5).Within(1e-3));
        }
    }
}
