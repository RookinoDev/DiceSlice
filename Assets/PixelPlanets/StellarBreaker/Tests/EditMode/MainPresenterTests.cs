using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;
using StellarBreaker.UI;

namespace StellarBreaker.Tests
{
    public class MainPresenterTests
    {
        BalanceConfig _cfg;
        FakePlanetProvider _provider;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _provider = new FakePlanetProvider();
        }

        [TearDown]
        public void TearDown()
        {
            _provider.Cleanup();
            Object.DestroyImmediate(_cfg);
        }

        [Test]
        public void Binds_Initial_State()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();
            var vm = new MainPresenter(s).Build();

            Assert.AreEqual("Stage 1", vm.stageLabel);
            Assert.IsFalse(vm.isBoss);
            Assert.That(vm.hpFraction, Is.EqualTo(1f).Within(1e-4));
            Assert.AreEqual("0", vm.stardustText);
            Assert.AreEqual("1.05", vm.tapDamageText);          // base tap damage
            Assert.AreEqual("0", vm.fleetDpsText);
            Assert.AreEqual("10", vm.tapUpgradeCostText);       // base upgrade cost
            Assert.IsFalse(vm.canUpgradeTap);                   // 0 < 10
        }

        [Test]
        public void HpFraction_Drops_After_Tap()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();
            s.Tap();
            var vm = new MainPresenter(s).Build();
            Assert.Less(vm.hpFraction, 1f);
            Assert.Greater(vm.hpFraction, 0f);
            StringAssert.Contains("/", vm.hpText);
        }

        [Test]
        public void Stardust_Text_Uses_Short_Format()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();
            s.Wallet.Add(new BigNumber(1_234_000.0));
            var vm = new MainPresenter(s).Build();
            Assert.AreEqual("1.23M", vm.stardustText);
        }
    }
}
