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

            Assert.AreEqual("Sector 1", vm.stageLabel);
            Assert.IsFalse(vm.isBoss);
            Assert.That(vm.hpFraction, Is.EqualTo(1f).Within(1e-4));
            Assert.AreEqual("0", vm.stardustText);
            Assert.AreEqual("1.05", vm.tapDamageText);          // base tap damage
            Assert.AreEqual("0", vm.fleetDpsText);
            Assert.AreEqual("10", vm.tapUpgradeCostText);       // base upgrade cost
            Assert.IsFalse(vm.canUpgradeTap);                   // 0 < 10
        }

        [Test]
        public void Fresh_Player_Hides_All_Advanced_Systems()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();
            var vm = new MainPresenter(s).Build();
            Assert.IsFalse(vm.showUpgradeTap, "upgrade hidden until first gold");
            Assert.IsFalse(vm.showFleet);
            Assert.IsFalse(vm.showArtifacts);
            Assert.IsFalse(vm.showPrestige);
            foreach (var sk in vm.skills) Assert.IsFalse(sk.unlocked);  // all skills locked at tap lvl 1
        }

        [Test]
        public void First_Gold_Reveals_Upgrade_Button()
        {
            var s = new GameSession(_provider, _cfg, 1);
            s.Begin();
            s.Enemy.ApplyDamage(new BigNumber(1.0, 9));   // first kill → gold
            var vm = new MainPresenter(s).Build();
            Assert.IsTrue(vm.showUpgradeTap);
            Assert.IsFalse(vm.showPrestige);              // still far from stage 10
        }

        [Test]
        public void Boss_Stage_Sets_Boss_View_Fields()
        {
            var s = new GameSession(_provider, _cfg, 5);   // stage 5 = boss
            s.Begin();
            var vm = new MainPresenter(s).Build();
            Assert.IsTrue(vm.isBoss);
            Assert.IsTrue(vm.bossActive);
            Assert.AreEqual(30, vm.bossSecondsLeft);
            StringAssert.Contains("5", vm.stageLabel);
        }

        [Test]
        public void No_Fleet_Disables_Ship_Button()
        {
            var s = new GameSession(_provider, _cfg, 1);   // no ships passed
            s.Begin();
            var vm = new MainPresenter(s).Build();
            Assert.IsFalse(vm.hasShip);
            Assert.IsFalse(vm.canBuyShip);
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
