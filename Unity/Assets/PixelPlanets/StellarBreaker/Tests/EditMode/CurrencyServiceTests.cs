using NUnit.Framework;
using StellarBreaker.Core;
using StellarBreaker.Economy;

namespace StellarBreaker.Tests
{
    public class CurrencyServiceTests
    {
        [Test]
        public void Starts_At_Zero()
        {
            Assert.That(new CurrencyService().Stardust.IsClose(BigNumber.Zero));
        }

        [Test]
        public void Add_Increases_Balance_And_Fires_Changed()
        {
            var w = new CurrencyService();
            int fired = 0;
            w.OnChanged += _ => fired++;

            w.Add(new BigNumber(100.0));
            Assert.That(w.Stardust.IsClose(new BigNumber(100.0)));
            Assert.AreEqual(1, fired);
        }

        [Test]
        public void Add_Zero_Or_Negative_Is_Ignored()
        {
            var w = new CurrencyService();
            int fired = 0;
            w.OnChanged += _ => fired++;

            w.Add(BigNumber.Zero);
            w.Add(new BigNumber(-50.0));
            Assert.That(w.Stardust.IsClose(BigNumber.Zero));
            Assert.AreEqual(0, fired);
        }

        [Test]
        public void TrySpend_Deducts_When_Affordable()
        {
            var w = new CurrencyService();
            w.Add(new BigNumber(100.0));
            int fired = 0;
            w.OnChanged += _ => fired++;

            bool ok = w.TrySpend(new BigNumber(30.0));
            Assert.IsTrue(ok);
            Assert.That(w.Stardust.IsClose(new BigNumber(70.0)));
            Assert.AreEqual(1, fired);
        }

        [Test]
        public void TrySpend_Rejects_When_Insufficient_NoChange()
        {
            var w = new CurrencyService();
            w.Add(new BigNumber(20.0));
            int fired = 0;
            w.OnChanged += _ => fired++;

            bool ok = w.TrySpend(new BigNumber(50.0));
            Assert.IsFalse(ok);
            Assert.That(w.Stardust.IsClose(new BigNumber(20.0)));
            Assert.AreEqual(0, fired);
        }

        [Test]
        public void CanAfford_Reflects_Balance()
        {
            var w = new CurrencyService();
            w.Add(new BigNumber(40.0));
            Assert.IsTrue(w.CanAfford(new BigNumber(40.0)));
            Assert.IsFalse(w.CanAfford(new BigNumber(41.0)));
        }
    }
}
