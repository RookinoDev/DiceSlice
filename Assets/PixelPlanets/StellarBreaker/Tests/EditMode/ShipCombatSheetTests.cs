using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Config;

namespace StellarBreaker.Tests
{
    /// <summary>
    /// Calibration: the catalog's level-1 effective DPS / hit damage / archetype must
    /// match the Ship Combat datasheet (tolerance 1%, sheet rounded to 3 s.f.).
    /// </summary>
    public class ShipCombatSheetTests
    {
        List<ShipDefinition> _roster;

        [SetUp]    public void SetUp()    => _roster = ShipCatalog.BuildDefault();
        [TearDown] public void TearDown()
        {
            foreach (var s in _roster) UnityEngine.Object.DestroyImmediate(s);
        }

        void Row(int idx, ShipArchetype arch, double cooldown, double dps, double hit)
        {
            var s = _roster[idx];
            Assert.AreEqual(arch, s.archetype, $"ship {idx + 1} archetype");
            Assert.That(s.baseCooldown,  Is.EqualTo(cooldown).Within(1e-9), $"ship {idx + 1} cd");
            Assert.That(s.baseDps,       Is.EqualTo(dps).Within(dps * 0.01), $"ship {idx + 1} dps");
            Assert.That(s.baseHitDamage, Is.EqualTo(hit).Within(hit * 0.01), $"ship {idx + 1} hit");
        }

        [Test] public void Ship1()  => Row(0,  ShipArchetype.Fast,   0.5, 5.0,      2.5);
        [Test] public void Ship2()  => Row(1,  ShipArchetype.Medium, 1.0, 54.6,     54.6);
        [Test] public void Ship3()  => Row(2,  ShipArchetype.Heavy,  2.0, 596.0,    1190.0);
        [Test] public void Ship4()  => Row(3,  ShipArchetype.Fast,   0.5, 6500.0,   3250.0);
        [Test] public void Ship7()  => Row(6,  ShipArchetype.Fast,   0.5, 8.46e6,   4.23e6);
        [Test] public void Ship19() => Row(18, ShipArchetype.Fast,   0.5, 2.419e19, 1.21e19);

        [Test]
        public void Archetype_Pattern_Repeats_Fast_Medium_Heavy()
        {
            for (int k = 0; k < _roster.Count; k++)
                Assert.AreEqual((ShipArchetype)(k % 3), _roster[k].archetype, $"ship {k + 1}");
        }
    }
}
