using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;
using StellarBreaker.Persistence;

namespace StellarBreaker.Tests
{
    public class ArtifactWiringTests
    {
        BalanceConfig _cfg;
        List<ShipDefinition> _ships;
        FakePlanetProvider _p1, _p2;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _ships = new List<ShipDefinition> { ShipDefinition.Create("A", 100, ShipArchetype.Fast, 0.5, 10) };
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

        GameSession Session(FakePlanetProvider p) => new GameSession(p, _cfg, 1, _ships);

        [Test]
        public void Buying_Dps_Artifact_Spends_Relics_And_Raises_Dps_Multiplier()
        {
            var s = Session(_p1);
            s.Begin();
            s.Prestige.Relics.Add(new BigNumber(1000.0));
            Assert.That(s.Artifacts.DpsMultiplier().ToDouble(), Is.EqualTo(1.0).Within(1e-9));

            Assert.IsTrue(s.BuyArtifact(0));   // Dps artifact, baseCost 10
            Assert.AreEqual(1, s.Artifacts.LevelOf(0));
            // Level 1 grants the full firstLevelBonus jump (0.20) — not a flat +5%/level.
            Assert.That(s.Artifacts.DpsMultiplier().ToDouble(), Is.EqualTo(1.0 + _cfg.artifactFirstLevelBonus).Within(1e-6));
            Assert.Less(s.Prestige.Relics.Stardust.ToDouble(), 1000.0);
        }

        [Test]
        public void Gold_Artifact_Multiplies_Kill_Reward()
        {
            var s = Session(_p1);
            s.Begin();
            s.Prestige.Relics.Add(new BigNumber(1000.0));
            s.BuyArtifact(1);                  // Gold artifact → level-1 bonus

            BigNumber paid = BigNumber.Zero;
            s.OnReward += (p, g) => paid = g;
            s.Enemy.ApplyDamage(new BigNumber(1.0, 9));   // kill stage 1 (gold 5)

            Assert.That(paid.ToDouble(), Is.EqualTo(5.0 * (1.0 + _cfg.artifactFirstLevelBonus)).Within(1e-4));
        }

        [Test]
        public void Tap_Artifact_Multiplies_Tap_Damage()
        {
            var s = Session(_p1);
            s.Begin();
            s.Prestige.Relics.Add(new BigNumber(1000.0));
            s.BuyArtifact(2);                  // TapDamage artifact → level-1 bonus

            var cd  = s.TapUpgrade.CurrentDamage;
            var max = s.Enemy.Current.MaxHP;
            s.Tap();
            var drop = max - s.Enemy.Current.CurrentHP;
            Assert.That(drop.IsClose(cd * new BigNumber(1.0 + _cfg.artifactFirstLevelBonus), 1e-4));
        }

        [Test]
        public void Artifact_Levels_Persist_Through_Save_Load()
        {
            var a = Session(_p1);
            a.Begin();
            a.Prestige.Relics.Add(new BigNumber(1000.0));
            a.BuyArtifact(0); a.BuyArtifact(0);   // Dps level 2

            var svc = new SaveService(new InMemorySaveStore());
            svc.Save(SaveBinder.Capture(a));
            Assert.IsTrue(svc.TryLoad(out var loaded));

            var b = Session(_p2);
            SaveBinder.Apply(b, loaded);
            Assert.AreEqual(2, b.Artifacts.LevelOf(0));
            // Level 2 = firstLevelBonus (level 1) + one extra bonusPerLevel step.
            double expected = 1.0 + _cfg.artifactFirstLevelBonus + _cfg.artifactBonusPerLevel;
            Assert.That(b.Artifacts.DpsMultiplier().ToDouble(), Is.EqualTo(expected).Within(1e-6));
            Assert.That(b.Prestige.Relics.Stardust.IsClose(a.Prestige.Relics.Stardust, 1e-4));
        }
    }
}
