using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class PrestigeArtifactTests
    {
        BalanceConfig _cfg;
        List<ShipDefinition> _ships;
        List<ArtifactDefinition> _artifacts;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _ships = new List<ShipDefinition>
            {
                ShipDefinition.Create("A", 100, ShipArchetype.Fast, 0.5, 10),
            };
            _artifacts = ArtifactCatalog.BuildDefault(_cfg);
        }

        [TearDown]
        public void TearDown()
        {
            foreach (var s in _ships) Object.DestroyImmediate(s);
            foreach (var a in _artifacts) Object.DestroyImmediate(a);
            Object.DestroyImmediate(_cfg);
        }

        [Test]
        public void Relics_From_Stage_Uses_Formula()
        {
            var p = new PrestigeService(_cfg); // start 5, scale 1, power 1
            Assert.That(p.RelicsForStage(4).IsClose(BigNumber.Zero));
            Assert.That(p.RelicsForStage(5).IsClose(BigNumber.Zero));   // 5-5 = 0
            Assert.That(p.RelicsForStage(15).ToDouble(), Is.EqualTo(10.0).Within(1e-9));
            Assert.That(p.RelicsForStage(105).ToDouble(), Is.EqualTo(100.0).Within(1e-9));
        }

        [Test]
        public void Prestige_Resets_Run_But_Relics_Persist()
        {
            var wallet = new CurrencyService();
            wallet.Add(new BigNumber(1.0, 6));
            var tap   = new TapDamageUpgrade(_cfg);
            tap.TryUpgrade(wallet); tap.TryUpgrade(wallet); // level 3
            var ships = new ShipService(_ships, _cfg);
            ships.BuyOrUpgrade(0, wallet);                  // level 1
            var stage = new StageManager(_cfg, 15);

            var p = new PrestigeService(_cfg);
            var gained = p.Prestige(stage.HighestStage, wallet, tap, ships, stage);

            Assert.That(gained.ToDouble(), Is.EqualTo(10.0).Within(1e-9));     // 15-5
            Assert.That(wallet.Stardust.IsClose(BigNumber.Zero));             // reset
            Assert.AreEqual(1, tap.Level);                                    // reset
            Assert.AreEqual(0, ships.LevelOf(0));                             // reset
            Assert.AreEqual(1, stage.CurrentStage);                          // reset
            Assert.That(p.Relics.Stardust.ToDouble(), Is.EqualTo(10.0).Within(1e-9)); // persists

            // second prestige accumulates relics
            var stage2 = new StageManager(_cfg, 25);
            p.Prestige(stage2.HighestStage, wallet, tap, ships, stage2);     // +20
            Assert.That(p.Relics.Stardust.ToDouble(), Is.EqualTo(30.0).Within(1e-9));
        }

        [Test]
        public void Artifacts_Multiply_Stats_And_Spend_Relics()
        {
            var relics = new CurrencyService();
            relics.Add(new BigNumber(1000.0));
            var arts = new ArtifactService(_artifacts, relics);

            // DPS artifact (index 0): bonus 0.05/level
            Assert.That(arts.DpsMultiplier().ToDouble(), Is.EqualTo(1.0).Within(1e-9));

            Assert.IsTrue(arts.BuyOrUpgrade(0)); // level 1
            Assert.IsTrue(arts.BuyOrUpgrade(0)); // level 2
            Assert.IsTrue(arts.BuyOrUpgrade(0)); // level 3
            Assert.That(arts.DpsMultiplier().ToDouble(), Is.EqualTo(1.15).Within(1e-6)); // 1 + 3×0.05

            Assert.Less(relics.Stardust.ToDouble(), 1000.0); // relics were spent
        }

        [Test]
        public void Artifact_Rejected_Without_Relics()
        {
            var relics = new CurrencyService(); // empty
            var arts = new ArtifactService(_artifacts, relics);
            Assert.IsFalse(arts.BuyOrUpgrade(0));
            Assert.AreEqual(0, arts.LevelOf(0));
        }
    }
}
