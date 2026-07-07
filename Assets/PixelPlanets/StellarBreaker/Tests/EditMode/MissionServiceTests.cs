using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class MissionServiceTests
    {
        List<MissionDefinition> _defs;

        [SetUp]
        public void SetUp()
        {
            _defs = new List<MissionDefinition>
            {
                MissionDefinition.Create(MissionType.DestroyPlanets, "Destroy 3 Planets", 3, 100),
                MissionDefinition.Create(MissionType.TapDamageTotal, "Deal 50 Tap Damage", 50, 200),
                MissionDefinition.Create(MissionType.ShipUpgrades,   "Upgrade Ships 2x",   2, 300),
            };
        }

        [TearDown]
        public void TearDown()
        {
            foreach (var d in _defs) Object.DestroyImmediate(d);
        }

        [Test]
        public void Progress_Accumulates_Per_Type_Independently()
        {
            var wallet = new CurrencyService();
            var m = new MissionService(_defs, wallet);

            m.NotifyPlanetDestroyed();
            m.NotifyPlanetDestroyed();
            Assert.That(m.Progress(0).ToDouble(), Is.EqualTo(2.0));
            Assert.That(m.Progress(1).ToDouble(), Is.EqualTo(0.0));
            Assert.That(m.Progress(2).ToDouble(), Is.EqualTo(0.0));
            Assert.IsFalse(m.IsComplete(0));

            m.NotifyPlanetDestroyed();
            Assert.IsTrue(m.IsComplete(0));
        }

        [Test]
        public void TapDamage_Progress_Sums_BigNumber_Amounts()
        {
            var wallet = new CurrencyService();
            var m = new MissionService(_defs, wallet);

            m.NotifyTapDamage(new BigNumber(20.0));
            m.NotifyTapDamage(new BigNumber(25.0));
            Assert.That(m.Progress(1).ToDouble(), Is.EqualTo(45.0));
            Assert.IsFalse(m.IsComplete(1));

            m.NotifyTapDamage(new BigNumber(10.0));
            Assert.IsTrue(m.IsComplete(1));
        }

        [Test]
        public void Claim_Pays_Gold_Once_And_Rejects_Before_Complete_Or_Twice()
        {
            var wallet = new CurrencyService();
            var m = new MissionService(_defs, wallet);

            Assert.IsFalse(m.Claim(2));   // not complete yet
            Assert.That(wallet.Stardust.IsClose(BigNumber.Zero));

            m.NotifyShipUpgraded();
            m.NotifyShipUpgraded();
            Assert.IsTrue(m.IsComplete(2));

            Assert.IsTrue(m.Claim(2));
            Assert.That(wallet.Stardust.IsClose(new BigNumber(300.0)));

            Assert.IsFalse(m.Claim(2));   // already claimed
            Assert.That(wallet.Stardust.IsClose(new BigNumber(300.0)));   // no double payout
        }

        [Test]
        public void Claimed_Mission_Stops_Tracking_Further_Progress()
        {
            var wallet = new CurrencyService();
            var m = new MissionService(_defs, wallet);

            m.NotifyPlanetDestroyed(); m.NotifyPlanetDestroyed(); m.NotifyPlanetDestroyed();
            Assert.IsTrue(m.Claim(0));

            m.NotifyPlanetDestroyed();   // extra progress after claim should be ignored
            Assert.That(m.Progress(0).ToDouble(), Is.EqualTo(3.0));
        }

        [Test]
        public void Progress01_Clamped_To_Unit_Range()
        {
            var wallet = new CurrencyService();
            var m = new MissionService(_defs, wallet);
            Assert.That(m.Progress01(0), Is.EqualTo(0f));

            m.NotifyPlanetDestroyed();
            Assert.That(m.Progress01(0), Is.EqualTo(1.0 / 3.0).Within(1e-6));

            m.NotifyPlanetDestroyed(); m.NotifyPlanetDestroyed(); m.NotifyPlanetDestroyed();
            Assert.That(m.Progress01(0), Is.EqualTo(1f));   // clamped, doesn't exceed 1
        }

        [Test]
        public void Save_Restore_Roundtrip_Preserves_Progress_And_Claimed()
        {
            var wallet = new CurrencyService();
            var m = new MissionService(_defs, wallet);
            m.NotifyPlanetDestroyed(); m.NotifyPlanetDestroyed(); m.NotifyPlanetDestroyed();
            m.Claim(0);
            m.NotifyTapDamage(new BigNumber(12.0));

            var progress = m.CaptureProgress();
            var claimed  = m.CaptureClaimed();

            var m2 = new MissionService(_defs, new CurrencyService());
            m2.RestoreProgress(progress, claimed);

            Assert.That(m2.Progress(0).ToDouble(), Is.EqualTo(3.0));
            Assert.IsTrue(m2.IsClaimed(0));
            Assert.That(m2.Progress(1).ToDouble(), Is.EqualTo(12.0));
            Assert.IsFalse(m2.IsClaimed(1));
        }
    }
}
