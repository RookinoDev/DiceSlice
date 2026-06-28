using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;
using StellarBreaker.Persistence;

namespace StellarBreaker.Tests
{
    public class SkillsPrestigeTests
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

        GameSession Session(int stage = 1) => new GameSession(_p1, _cfg, stage, _ships);

        static void RaiseTapLevel(GameSession s, int target)
        {
            s.Wallet.Add(new BigNumber(1.0, 9));
            while (s.TapUpgrade.Level < target) s.UpgradeTapDamage();
        }

        [Test]
        public void TapBoost_Skill_Multiplies_Tap_Damage()
        {
            var s = Session();
            s.Begin();
            RaiseTapLevel(s, 3);                       // unlocks Overdrive (Tap+)

            Assert.IsTrue(s.ActivateSkill(SkillType.Overdrive));
            Assert.IsTrue(s.Skills.IsActive(SkillType.Overdrive));
            Assert.That(s.Skills.TapDamageMultiplier().ToDouble(), Is.EqualTo(1.7).Within(1e-6));

            var cd  = s.TapUpgrade.CurrentDamage;
            var max = s.Enemy.Current.MaxHP;
            s.Tap();
            var drop = max - s.Enemy.Current.CurrentHP;
            Assert.That(drop.IsClose(cd * new BigNumber(1.7), 1e-4));   // ×1.7 applied
        }

        [Test]
        public void DpsBoost_Skill_Multiplies_Idle_Dps()
        {
            var s = Session();
            s.Begin();
            RaiseTapLevel(s, 5);                       // unlocks BattleCry (DPS+)
            s.BuyShip(0);

            Assert.IsTrue(s.ActivateSkill(SkillType.BattleCry));
            Assert.That(s.Skills.DpsMultiplier().ToDouble(), Is.EqualTo(2.5).Within(1e-6));
        }

        [Test]
        public void Meteor_Deals_Instant_Damage()
        {
            var s = Session();
            s.Begin();
            RaiseTapLevel(s, 2);                       // unlocks Meteor

            Assert.IsTrue(s.ActivateSkill(SkillType.MeteorStrike));
            // 70×(1+1)×tapDamage ≫ stage-1 HP → it dies and we advance
            Assert.AreEqual(2, s.Stage.CurrentStage);
        }

        [Test]
        public void Skill_Goes_On_Cooldown_Then_Recovers()
        {
            var s = Session();
            s.Begin();
            RaiseTapLevel(s, 2);

            s.ActivateSkill(SkillType.MeteorStrike);
            Assert.IsFalse(s.Skills.CanActivate(SkillType.MeteorStrike));  // cooldown 20s
            s.Tick(21.0);
            Assert.IsTrue(s.Skills.CanActivate(SkillType.MeteorStrike));
        }

        [Test]
        public void Skill_Locked_Below_Unlock_Level()
        {
            var s = Session();
            s.Begin();
            Assert.IsFalse(s.Skills.IsUnlocked(SkillType.BattleCry)); // needs tap level 5
            Assert.IsFalse(s.ActivateSkill(SkillType.BattleCry));
        }

        // ── Prestige ────────────────────────────────────────────────
        [Test]
        public void Prestige_Locked_Below_Threshold()
        {
            var s = Session(1);
            s.Begin();
            Assert.IsFalse(s.CanPrestige());          // stage 1 < 10
            Assert.That(s.DoPrestige().IsClose(BigNumber.Zero));
        }

        [Test]
        public void Prestige_Resets_Run_And_Grants_Relics()
        {
            var s = Session(10);                       // HighestStage = 10 on Begin
            s.Begin();
            s.Wallet.Add(new BigNumber(1.0, 6));
            s.UpgradeTapDamage();

            Assert.IsTrue(s.CanPrestige());
            Assert.That(s.PreviewRelics().ToDouble(), Is.EqualTo(5.0).Within(1e-9)); // 10-5

            var gained = s.DoPrestige();
            Assert.That(gained.ToDouble(), Is.EqualTo(5.0).Within(1e-9));
            Assert.AreEqual(1, s.Stage.CurrentStage);
            Assert.AreEqual(1, s.TapUpgrade.Level);
            Assert.That(s.Wallet.Stardust.IsClose(BigNumber.Zero));
            Assert.That(s.Prestige.Relics.Stardust.ToDouble(), Is.EqualTo(5.0).Within(1e-9));
        }

        [Test]
        public void Relics_Persist_Through_Save_Load()
        {
            var a = Session(10);
            a.Begin();
            a.DoPrestige();                            // grants 5 relics

            var store = new InMemorySaveStore();
            var svc = new SaveService(store);
            svc.Save(SaveBinder.Capture(a));
            Assert.IsTrue(svc.TryLoad(out var loaded));

            var b = new GameSession(_p2, _cfg, 1, _ships);
            SaveBinder.Apply(b, loaded);
            Assert.That(b.Prestige.Relics.Stardust.ToDouble(), Is.EqualTo(5.0).Within(1e-9));
        }
    }
}
