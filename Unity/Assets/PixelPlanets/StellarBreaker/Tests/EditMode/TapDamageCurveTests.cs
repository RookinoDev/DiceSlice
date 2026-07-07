using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Tests
{
    public class TapDamageCurveTests
    {
        BalanceConfig _cfg;

        [SetUp]    public void SetUp()    => _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
        [TearDown] public void TearDown() => Object.DestroyImmediate(_cfg);

        double D(int level) => TapDamageCurve.ForLevel(level, _cfg).ToDouble();

        [Test]
        public void Level1_Is_Base()
        {
            Assert.That(D(1), Is.EqualTo(1.05).Within(1e-9));
        }

        [Test]
        public void Level2_Uses_Start_Multiplier()
        {
            // damage(2) = base × start
            Assert.That(D(2), Is.EqualTo(1.05 * 2.10).Within(1e-6));
            Assert.That(D(2) / D(1), Is.EqualTo(2.10).Within(1e-6)); // first ratio = start
        }

        [Test]
        public void Damage_Is_Strictly_Increasing()
        {
            for (int l = 1; l < 40; l++)
                Assert.Less(D(l), D(l + 1), $"level {l} → {l + 1}");
        }

        [Test]
        public void PerLevel_Ratio_Eases_From_Start_Toward_End()
        {
            double rEarly = D(3)  / D(2);
            double rMid   = D(20) / D(19);
            double rLate  = D(60) / D(59);

            Assert.Greater(rEarly, rMid);      // ratio decreasing
            Assert.Greater(rMid,   rLate);
            Assert.Greater(rLate,  1.15);      // never below end…
            Assert.Less(rLate,     2.10);      // …never above start
            Assert.That(rLate, Is.EqualTo(1.15).Within(0.06)); // approaching end
        }

        [Test]
        public void Huge_Level_Stays_Finite_And_Large()
        {
            var d = TapDamageCurve.ForLevel(1000, _cfg);
            Assert.IsFalse(double.IsNaN(d.Mantissa));
            Assert.Greater(d.Exponent, 0);                 // astronomically large
            Assert.IsTrue(d > TapDamageCurve.ForLevel(999, _cfg));
        }
    }
}
