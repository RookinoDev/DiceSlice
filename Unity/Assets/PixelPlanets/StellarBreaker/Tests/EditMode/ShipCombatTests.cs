using System;
using NUnit.Framework;
using StellarBreaker.Core;
using StellarBreaker.Economy;

namespace StellarBreaker.Tests
{
    public class ShipCombatTests
    {
        static readonly int[]    MsLevels = { 25, 50, 100, 200, 400 };
        static readonly double[] MsMults  = { 2, 2, 3, 3, 5 };
        static readonly int[]    Breakpts = { 100, 200, 300, 400, 500 };
        const double Factor = 0.85, Min = 0.2, DmgPerLevel = 1.27;

        // ── Milestones ───────────────────────────────────────────────
        [Test]
        public void Milestone_Multiplier_Is_Cumulative_Product()
        {
            double M(int lvl) => ShipCombat.MilestoneMultiplier(lvl, MsLevels, MsMults).ToDouble();
            Assert.That(M(24),  Is.EqualTo(1).Within(1e-9));
            Assert.That(M(25),  Is.EqualTo(2).Within(1e-9));     // ×2
            Assert.That(M(50),  Is.EqualTo(4).Within(1e-9));     // ×2×2
            Assert.That(M(100), Is.EqualTo(12).Within(1e-9));    // ×2×2×3
            Assert.That(M(200), Is.EqualTo(36).Within(1e-9));    // ×…×3
            Assert.That(M(400), Is.EqualTo(180).Within(1e-9));   // ×…×5
        }

        // ── Damage per level ─────────────────────────────────────────
        [Test]
        public void HitDamage_Scales_127_Per_Level()
        {
            double H(int lvl) => ShipCombat.HitDamage(lvl, 2.5, DmgPerLevel, MsLevels, MsMults).ToDouble();
            Assert.That(H(1), Is.EqualTo(2.5).Within(1e-9));
            Assert.That(H(2), Is.EqualTo(2.5 * 1.27).Within(1e-6));
            Assert.That(H(11), Is.EqualTo(2.5 * Math.Pow(1.27, 10)).Within(2.5 * Math.Pow(1.27, 10) * 1e-6));
        }

        // ── Cooldown breakpoints ─────────────────────────────────────
        [Test]
        public void Cooldown_Improves_Only_At_Breakpoints()
        {
            Assert.That(ShipCombat.Cooldown(99,  0.5, Breakpts, Factor, Min), Is.EqualTo(0.5).Within(1e-9));
            Assert.That(ShipCombat.Cooldown(100, 0.5, Breakpts, Factor, Min), Is.EqualTo(0.5 * 0.85).Within(1e-9));
            Assert.That(ShipCombat.Cooldown(300, 0.5, Breakpts, Factor, Min), Is.EqualTo(0.5 * Math.Pow(0.85, 3)).Within(1e-9));
        }

        [Test]
        public void Cooldown_Has_Minimum_Floor()
        {
            // base 0.3 at lvl 500 → 0.3×0.85^5 ≈ 0.133 → clamped to 0.2
            Assert.That(ShipCombat.Cooldown(500, 0.3, Breakpts, Factor, Min), Is.EqualTo(0.2).Within(1e-9));
        }

        // ── Effective DPS ────────────────────────────────────────────
        [Test]
        public void EffectiveDps_At_Level1_Equals_BaseDps()
        {
            // baseHit 2.5, cd 0.5 → 5 DPS (ship 1)
            var dps = ShipCombat.EffectiveDps(1, 2.5, 0.5, DmgPerLevel, Breakpts, Factor, Min, MsLevels, MsMults);
            Assert.That(dps.ToDouble(), Is.EqualTo(5.0).Within(1e-6));
        }

        [Test]
        public void Breakpoint_Gives_Double_Jump_From_Damage_And_Speed()
        {
            double D(int lvl) => ShipCombat.EffectiveDps(lvl, 2.5, 0.5, DmgPerLevel,
                                    Breakpts, Factor, Min, MsLevels, MsMults).ToDouble();
            // lvl100 gains: ×1.27 (dmg) × (milestone 100 adds ×3) ÷ 0.85 (cooldown) vs lvl99
            double ratio = D(100) / D(99);
            Assert.Greater(ratio, 1.27 * 3.0 / 0.85 * 0.99); // ≈ 4.48, allow slack
        }
    }
}
