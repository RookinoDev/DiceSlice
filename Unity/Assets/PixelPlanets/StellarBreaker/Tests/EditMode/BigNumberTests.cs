using NUnit.Framework;
using StellarBreaker.Core;

namespace StellarBreaker.Tests
{
    public class BigNumberTests
    {
        [Test]
        public void Construct_Normalizes_Mantissa_To_OneToTen()
        {
            var n = new BigNumber(1234.0);
            Assert.AreEqual(3, n.Exponent);
            Assert.That(n.Mantissa, Is.EqualTo(1.234).Within(1e-9));
        }

        [Test]
        public void Add_Large_Equal_Exponents()
        {
            var r = new BigNumber(1.0, 100) + new BigNumber(1.0, 100); // 1e100 + 1e100
            Assert.AreEqual(100, r.Exponent);
            Assert.That(r.Mantissa, Is.EqualTo(2.0).Within(1e-9));
        }

        [Test]
        public void Add_Negligible_Smaller_Term_Is_Ignored()
        {
            var r = new BigNumber(1.0, 100) + new BigNumber(1.0, 0); // 1e100 + 1
            Assert.AreEqual(100, r.Exponent);
            Assert.That(r.Mantissa, Is.EqualTo(1.0).Within(1e-9));
        }

        [Test]
        public void Subtract_Works()
        {
            var r = new BigNumber(3.0, 10) - new BigNumber(1.0, 10); // 3e10 - 1e10
            Assert.That(r.IsClose(new BigNumber(2.0, 10)));
        }

        [Test]
        public void Multiply_Adds_Exponents()
        {
            var r = new BigNumber(1.0, 50) * new BigNumber(1.0, 50);
            Assert.AreEqual(100, r.Exponent);
            Assert.That(r.Mantissa, Is.EqualTo(1.0).Within(1e-9));
        }

        [Test]
        public void Multiply_With_Mantissa_Renormalizes()
        {
            var r = new BigNumber(5.0, 3) * new BigNumber(4.0, 2); // 5000 * 400 = 2,000,000
            Assert.AreEqual(6, r.Exponent);
            Assert.That(r.Mantissa, Is.EqualTo(2.0).Within(1e-9));
        }

        [Test]
        public void Divide_Subtracts_Exponents()
        {
            var r = new BigNumber(1.0, 100) / new BigNumber(1.0, 50);
            Assert.AreEqual(50, r.Exponent);
            Assert.That(r.Mantissa, Is.EqualTo(1.0).Within(1e-9));
        }

        [Test]
        public void Divide_By_Zero_Throws()
        {
            Assert.Throws<System.DivideByZeroException>(() =>
            {
                var _ = new BigNumber(1.0, 5) / BigNumber.Zero;
            });
        }

        [Test]
        public void Pow_Matches_Enemy_Hp_Formula()
        {
            // HP(stage) = 29 × 1.57^(stage-1); stage 10 → 29 × 1.57^9
            var hp = new BigNumber(29.0) * new BigNumber(1.57).Pow(9);
            double expected = 29.0 * System.Math.Pow(1.57, 9);
            Assert.That(hp.ToDouble(), Is.EqualTo(expected).Within(expected * 1e-6));
        }

        [Test]
        public void Pow_Handles_Huge_Exponents()
        {
            var r = new BigNumber(10.0).Pow(40); // 10^40
            Assert.AreEqual(40, r.Exponent);
            Assert.That(r.Mantissa, Is.EqualTo(1.0).Within(1e-6));
        }

        [Test]
        public void Compare_Operators()
        {
            Assert.IsTrue(new BigNumber(1.0, 100) > new BigNumber(9.9, 99));
            Assert.IsTrue(new BigNumber(1.0, 5)  < new BigNumber(2.0, 5));
            Assert.IsTrue(new BigNumber(5.0, 5) == new BigNumber(5.0, 5));
            Assert.IsTrue(BigNumber.Zero < BigNumber.One);
        }

        [Test]
        public void Zero_Identity()
        {
            var r = BigNumber.Zero + new BigNumber(5.0);
            Assert.That(r.IsClose(new BigNumber(5.0)));
            Assert.That((new BigNumber(7.0) * BigNumber.Zero).IsClose(BigNumber.Zero));
        }

        // ── ToShortString ───────────────────────────────────────────
        [Test]
        public void ToShortString_Plain_Under_1000()
        {
            Assert.AreEqual("999", new BigNumber(999.0).ToShortString());
            Assert.AreEqual("42",  new BigNumber(42.0).ToShortString());
            Assert.AreEqual("0",   BigNumber.Zero.ToShortString());
        }

        [Test]
        public void ToShortString_1234_Is_123K()
        {
            Assert.AreEqual("1.23K", new BigNumber(1234.0).ToShortString());
        }

        [Test]
        public void ToShortString_1Point2M()
        {
            Assert.AreEqual("1.20M", new BigNumber(1_200_000.0).ToShortString());
        }

        [Test]
        public void ToShortString_1e30_Uses_Letter_Suffix()
        {
            Assert.AreEqual("1.00af", new BigNumber(1.0, 30).ToShortString());
        }

        [Test]
        public void ToShortString_Suffix_Progression()
        {
            Assert.AreEqual("1.00B", new BigNumber(1.0, 9).ToShortString());
            Assert.AreEqual("1.00T", new BigNumber(1.0, 12).ToShortString());
            Assert.AreEqual("1.00aa", new BigNumber(1.0, 15).ToShortString()); // first letter group
        }
    }
}
