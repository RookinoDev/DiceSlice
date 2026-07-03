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

        // Same formula as PrestigeService.RelicsForStage, used to compute expected values
        // instead of hardcoding pre-calculated numbers (keeps the test valid if the tunable
        // scale/power in BalanceConfig are retuned again later).
        double ExpectedRelics(int highestStage)
        {
            int s = System.Math.Max(0, highestStage - _cfg.relicStartStage);
            return s <= 0 ? 0.0 : System.Math.Floor(_cfg.relicScale * System.Math.Pow(s, _cfg.relicPower));
        }

        [Test]
        public void Relics_From_Stage_Uses_SuperLinear_Formula()
        {
            var p = new PrestigeService(_cfg);
            Assert.That(p.RelicsForStage(4).IsClose(BigNumber.Zero));
            Assert.That(p.RelicsForStage(5).IsClose(BigNumber.Zero));   // 5-5 = 0

            Assert.That(p.RelicsForStage(15).ToDouble(), Is.EqualTo(ExpectedRelics(15)).Within(1e-6));
            Assert.That(p.RelicsForStage(105).ToDouble(), Is.EqualTo(ExpectedRelics(105)).Within(1e-6));

            // Super-linear: doubling the progress-beyond-start more than doubles the reward.
            double small = p.RelicsForStage(_cfg.relicStartStage + 5).ToDouble();
            double big   = p.RelicsForStage(_cfg.relicStartStage + 10).ToDouble();
            Assert.Greater(big, small * 2.0);
        }

        [Test]
        public void First_Prestige_At_Unlock_Stage_Funds_At_Least_One_Artifact_Level()
        {
            var p = new PrestigeService(_cfg);
            var relicsAtUnlock = p.RelicsForStage(_cfg.prestigeUnlockStage);
            var cheapestArtifactCost = new BigNumber(_cfg.artifactBaseCost);   // level-1 cost of the cheapest artifact
            Assert.IsTrue(relicsAtUnlock >= cheapestArtifactCost,
                "first prestige should afford at least one artifact level");
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

            Assert.That(gained.ToDouble(), Is.EqualTo(ExpectedRelics(15)).Within(1e-6));
            Assert.That(wallet.Stardust.IsClose(BigNumber.Zero));             // reset
            Assert.AreEqual(1, tap.Level);                                    // reset
            Assert.AreEqual(0, ships.LevelOf(0));                             // reset
            Assert.AreEqual(1, stage.CurrentStage);                          // reset
            Assert.That(p.Relics.Stardust.ToDouble(), Is.EqualTo(ExpectedRelics(15)).Within(1e-6)); // persists

            // second prestige accumulates relics
            var stage2 = new StageManager(_cfg, 25);
            p.Prestige(stage2.HighestStage, wallet, tap, ships, stage2);
            Assert.That(p.Relics.Stardust.ToDouble(),
                        Is.EqualTo(ExpectedRelics(15) + ExpectedRelics(25)).Within(1e-6));
        }

        [Test]
        public void Artifacts_Multiply_Stats_And_Spend_Relics()
        {
            var relics = new CurrencyService();
            relics.Add(new BigNumber(1000.0));
            var arts = new ArtifactService(_artifacts, relics);

            Assert.That(arts.DpsMultiplier().ToDouble(), Is.EqualTo(1.0).Within(1e-9));

            Assert.IsTrue(arts.BuyOrUpgrade(0)); // level 1 → big first-level jump
            double afterLevel1 = arts.DpsMultiplier().ToDouble();
            Assert.That(afterLevel1, Is.EqualTo(1.0 + _cfg.artifactFirstLevelBonus).Within(1e-6));
            Assert.GreaterOrEqual(_cfg.artifactFirstLevelBonus, 0.15);   // "noticeable" per design intent

            Assert.IsTrue(arts.BuyOrUpgrade(0)); // level 2
            Assert.IsTrue(arts.BuyOrUpgrade(0)); // level 3
            double expected = 1.0 + _cfg.artifactFirstLevelBonus + 2 * _cfg.artifactBonusPerLevel;
            Assert.That(arts.DpsMultiplier().ToDouble(), Is.EqualTo(expected).Within(1e-6));

            // Later levels add less than the first level did (scales slower).
            Assert.Less(_cfg.artifactBonusPerLevel, _cfg.artifactFirstLevelBonus);

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
