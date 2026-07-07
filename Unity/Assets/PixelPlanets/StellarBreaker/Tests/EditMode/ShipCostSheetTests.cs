using NUnit.Framework;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Tests
{
    /// <summary>
    /// Calibration: the real base costs + ×1.075 per-level growth must reproduce the
    /// datasheet's cumulative "to Lvl X" columns. Tolerance 1% (sheet is rounded to 3 s.f.).
    /// </summary>
    public class ShipCostSheetTests
    {
        const double Growth = 1.075;

        static double Cum(double baseCost, int level)
            => UpgradeCost.CumulativeTo(level, baseCost, Growth).ToDouble();

        static void Check(double baseCost, int level, double expected)
            => Assert.That(Cum(baseCost, level), Is.EqualTo(expected).Within(expected * 0.01),
                           $"base {baseCost}, lvl {level}");

        [Test]
        public void Ship1_Matches_Sheet()
        {
            Check(50, 1,   50);
            Check(50, 10,  707);
            Check(50, 25,  3_400);
            Check(50, 50,  24_130);
            Check(50, 100, 921_380);
        }

        [Test]
        public void Ship8_Matches_Sheet()
        {
            Check(2_680_000, 10,  37.91e6);
            Check(2_680_000, 50,  1.29e9);
            Check(2_680_000, 100, 49.39e9);
        }

        [Test]
        public void Ship19_Matches_Sheet()
        {
            Check(2.46e17, 1,   2.46e17);
            Check(2.46e17, 10,  3.48e18);
            Check(2.46e17, 100, 4.53e21);
        }

        [Test]
        public void Catalog_Has_Real_Base_Costs()
        {
            var roster = ShipCatalog.BuildDefault();
            Assert.AreEqual(19, roster.Count);
            Assert.That(roster[0].baseCost,  Is.EqualTo(50.0).Within(1e-9));
            Assert.That(roster[6].baseCost,  Is.EqualTo(384_000.0).Within(1e-3));   // ship 7
            Assert.That(roster[18].baseCost, Is.EqualTo(2.46e17).Within(2.46e17 * 1e-9)); // ship 19
            foreach (var s in roster) UnityEngine.Object.DestroyImmediate(s);
        }
    }
}
