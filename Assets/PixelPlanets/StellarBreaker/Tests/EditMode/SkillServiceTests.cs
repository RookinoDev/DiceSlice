using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    public class SkillServiceTests
    {
        BalanceConfig _cfg;
        List<SkillDefinition> _defs;
        int _playerLevel;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _defs = SkillCatalog.BuildDefault(_cfg);
            _playerLevel = 1000; // everything unlocked unless a test lowers it
        }

        [TearDown]
        public void TearDown()
        {
            foreach (var d in _defs) Object.DestroyImmediate(d);
            Object.DestroyImmediate(_cfg);
        }

        SkillService Make() => new SkillService(_defs, () => _playerLevel);

        [Test]
        public void Skills_Unlock_At_Correct_Levels()
        {
            var s = Make();
            int[] expected = { 50, 100, 200, 300, 400, 500 };
            SkillType[] order =
            {
                SkillType.MeteorStrike, SkillType.DroneSwarm, SkillType.TargetingSystem,
                SkillType.BattleCry, SkillType.Overdrive, SkillType.MidasBeam,
            };
            for (int i = 0; i < order.Length; i++)
            {
                _playerLevel = expected[i] - 1;
                Assert.IsFalse(s.IsUnlocked(order[i]), $"{order[i]} should be locked at {_playerLevel}");
                _playerLevel = expected[i];
                Assert.IsTrue(s.IsUnlocked(order[i]), $"{order[i]} should unlock at {_playerLevel}");
            }
        }

        [Test]
        public void Meteor_Strike_Instant_Damage_Is_Correct()
        {
            var s = Make();
            s.SetLevel(SkillType.MeteorStrike, 1);
            var dmg = s.Activate(SkillType.MeteorStrike, new BigNumber(100.0));
            // 70 × (1+1) × 100 = 14000
            Assert.That(dmg.ToDouble(), Is.EqualTo(14000.0).Within(1e-6));
        }

        [Test]
        public void BattleCry_Buffs_Dps_Then_Expires()
        {
            var s = Make();
            s.SetLevel(SkillType.BattleCry, 1);             // +(50+100)=150% → ×2.5
            Assert.That(s.DpsMultiplier().ToDouble(), Is.EqualTo(1.0).Within(1e-9));

            s.Activate(SkillType.BattleCry, BigNumber.Zero);
            Assert.That(s.DpsMultiplier().ToDouble(), Is.EqualTo(2.5).Within(1e-6));

            s.Tick(31.0);                                   // duration 30 → expired
            Assert.IsFalse(s.IsActive(SkillType.BattleCry));
            Assert.That(s.DpsMultiplier().ToDouble(), Is.EqualTo(1.0).Within(1e-9));
        }

        [Test]
        public void Overdrive_And_Midas_And_Targeting_And_Drone_Formulas()
        {
            var s = Make();
            s.Activate(SkillType.Overdrive, BigNumber.Zero);     // +(30+40)=70% → ×1.7
            s.Activate(SkillType.MidasBeam, BigNumber.Zero);     // +(5+10)=15% → ×1.15
            s.Activate(SkillType.TargetingSystem, BigNumber.Zero); // +(3+41)=44 pts
            s.Activate(SkillType.DroneSwarm, BigNumber.Zero);    // 3+4 = 7 taps/s

            Assert.That(s.TapDamageMultiplier().ToDouble(), Is.EqualTo(1.70).Within(1e-6));
            Assert.That(s.GoldMultiplier().ToDouble(),      Is.EqualTo(1.15).Within(1e-6));
            Assert.That(s.CritChanceBonusPercent(),         Is.EqualTo(44.0).Within(1e-6));
            Assert.That(s.DroneTapsPerSecond(),             Is.EqualTo(7.0).Within(1e-6));
        }

        [Test]
        public void Cannot_Activate_When_Locked_Or_On_Cooldown()
        {
            var s = Make();
            _playerLevel = 10; // Battle Cry locked (needs 300)
            Assert.IsFalse(s.CanActivate(SkillType.BattleCry));

            _playerLevel = 1000;
            Assert.IsTrue(s.CanActivate(SkillType.BattleCry));
            s.Activate(SkillType.BattleCry, BigNumber.Zero);
            Assert.IsFalse(s.CanActivate(SkillType.BattleCry)); // on cooldown / active
        }

        [Test]
        public void Cooldown_Expires_And_Reduction_Shortens_It()
        {
            var s = Make();
            s.Activate(SkillType.Overdrive, BigNumber.Zero); // cd 120
            s.Tick(60);
            Assert.Greater(s.Cooldown(SkillType.Overdrive), 0);
            s.Tick(70);
            Assert.That(s.Cooldown(SkillType.Overdrive), Is.EqualTo(0).Within(1e-9));

            s.SetCooldownReduction(0.5);
            s.Activate(SkillType.Overdrive, BigNumber.Zero);
            Assert.That(s.Cooldown(SkillType.Overdrive), Is.EqualTo(60.0).Within(1e-6)); // 120 × 0.5
        }
    }
}
