using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class SkillEffectsTests
    {
        BalanceConfig _cfg;
        FakePlanetProvider _p;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _p = new FakePlanetProvider();
        }

        [TearDown]
        public void TearDown()
        {
            _p.Cleanup();
            Object.DestroyImmediate(_cfg);
        }

        static void RaiseTapLevel(GameSession s, int target)
        {
            s.Wallet.Add(new BigNumber(1.0, 9));
            while (s.TapUpgrade.Level < target) s.UpgradeTapDamage();
        }

        [Test]
        public void Prototype_Skills_Are_The_Five_Wired_Ones_Crit_Excluded()
        {
            var s = new GameSession(_p, _cfg, 1);
            CollectionAssert.AreEquivalent(
                new[] { SkillType.Overdrive, SkillType.BattleCry, SkillType.MeteorStrike,
                        SkillType.DroneSwarm, SkillType.MidasBeam },
                s.SkillSlots);
            CollectionAssert.DoesNotContain(s.SkillSlots, SkillType.TargetingSystem); // crit not exposed
        }

        [Test]
        public void Drone_Swarm_Deals_Real_Auto_Tap_Damage_While_Active()
        {
            var s = new GameSession(_p, _cfg, 5);   // boss stage = big HP so the tick won't kill
            s.Begin();
            RaiseTapLevel(s, 4);                     // unlocks Drone

            Assert.IsTrue(s.ActivateSkill(SkillType.DroneSwarm));
            Assert.That(s.Skills.DroneTapsPerSecond(), Is.EqualTo(7.0).Within(1e-9)); // 3×1+4

            var cd     = s.TapUpgrade.CurrentDamage;
            var before = s.Enemy.Current.CurrentHP;
            s.Tick(0.5);                              // no ships → only drone damage
            var drop = before - s.Enemy.Current.CurrentHP;

            Assert.That(drop.IsClose(cd * new BigNumber(7.0 * 0.5), 1e-4)); // taps×dt
        }

        [Test]
        public void Midas_Beam_Boosts_Gold_While_Active()
        {
            var s = new GameSession(_p, _cfg, 1);
            s.Begin();
            RaiseTapLevel(s, 6);                      // unlocks Midas

            Assert.IsTrue(s.ActivateSkill(SkillType.MidasBeam));
            Assert.That(s.Skills.GoldMultiplier().ToDouble(), Is.EqualTo(1.15).Within(1e-6)); // 5×1+10 → +15%

            BigNumber paid = BigNumber.Zero;
            s.OnReward += (p, g) => paid = g;
            s.Enemy.ApplyDamage(new BigNumber(1.0, 9));   // kill stage 1 (base gold 5)

            Assert.That(paid.ToDouble(), Is.EqualTo(5.0 * 1.15).Within(1e-4));
        }

        [Test]
        public void Tap_Skill_Still_Works_After_Adding_New_Skills()
        {
            var s = new GameSession(_p, _cfg, 1);
            s.Begin();
            RaiseTapLevel(s, 3);
            Assert.IsTrue(s.ActivateSkill(SkillType.Overdrive));
            Assert.That(s.Skills.TapDamageMultiplier().ToDouble(), Is.EqualTo(1.7).Within(1e-6));
        }
    }
}
