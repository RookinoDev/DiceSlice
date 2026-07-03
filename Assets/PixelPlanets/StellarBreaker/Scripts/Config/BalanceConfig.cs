using UnityEngine;

namespace StellarBreaker.Config
{
    /// <summary>
    /// Tunable balance data. Curves are computed elsewhere from these PARAMETERS
    /// (Phase 3+). These numbers are calibration references from the datasheet —
    /// no hardcoded per-level tables.
    /// </summary>
    [CreateAssetMenu(menuName = "StellarBreaker/BalanceConfig", fileName = "BalanceConfig")]
    public class BalanceConfig : ScriptableObject
    {
        [Header("Enemy HP — HP(stage) = base × growth^(stage-1)")]
        public double enemyHpBase   = 29.0;
        public double enemyHpGrowth = 1.57;

        [Tooltip("Repeating boss HP multiplier cycle; bossHP = enemyHP × multiplier")]
        public int[] bossMultipliers = { 2, 4, 6, 7, 10 };

        [Header("Tap damage — base at lvl1, per-level multiplier eases start→end")]
        public double tapDamageBase  = 1.05;
        public double tapGrowthStart = 2.10;   // early per-level multiplier
        public double tapGrowthEnd   = 1.15;   // asymptotic per-level multiplier
        [Tooltip("Easing rate (0..1): how fast the per-level multiplier decays start→end")]
        public double tapGrowthDecay = 0.92;

        [Header("Stardust reward — gold(stage) = base × growth^(stage-1)")]
        public double goldBase           = 5.0;
        public double goldGrowth         = 1.15;
        public double bossGoldMultiplier = 3.0;

        [Header("Tap-damage upgrade cost — cost(n) = base × growth^(n-1)")]
        public double tapUpgradeBaseCost   = 10.0;
        public double tapUpgradeCostGrowth = 1.12;

        [Header("Ships — cost(n) = base × perLevelGrowth^(n-1)")]
        public double shipBaseCost        = 50.0;    // ship 1 base cost
        public double shipCostPerLevel    = 1.075;   // per-level growth within a ship
        [Tooltip("Base-cost growth between consecutive ships (datasheet range ×3.5…×8.9)")]
        public double shipBaseCostGrowthMin = 3.5;
        public double shipBaseCostGrowthMax = 8.9;
        public int    shipCount             = 19;    // extensible

        [Header("Ship combat — cooldown-based hits")]
        public double   shipBaseDpsFirst       = 5.0;     // effective DPS of ship 1 @ lvl1
        public double   shipDamagePerLevel     = 1.27;    // Hit Damage × per level
        [Tooltip("Base cooldowns per archetype: Fast, Medium, Heavy (seconds)")]
        public double[] shipArchetypeCooldowns = { 0.5, 1.0, 2.0 };

        [Header("Ship cooldown breakpoints (speed-ups)")]
        public int[]  shipCooldownBreakpoints = { 100, 200, 300, 400, 500 };
        public double shipCooldownFactor       = 0.85;    // ×cooldown at each breakpoint
        public double shipCooldownMin          = 0.2;     // floor (seconds)

        [Header("Ship DPS milestones (per-level ×multipliers)")]
        public int[]    shipMilestoneLevels      = { 25, 50, 100, 200, 400 };
        public double[] shipMilestoneMultipliers = { 2, 2, 3, 3, 5 };

        [Tooltip("DEFERRED (no artifact system yet): fraction of fleet DPS added to each manual tap")]
        public double dpsTapShare = 0.0;

        // ── Phase 5: bosses & progression ────────────────────────────
        [Header("Bosses")]
        [Tooltip("Every Nth stage is a boss (multiplier cycles through bossMultipliers)")]
        public int    bossStageInterval = 5;
        public float  bossTimerSeconds  = 30f;

        // ── Phase 6: skills ──────────────────────────────────────────
        [Header("Skills")]
        public float skillDefaultCooldown = 120f;

        [Header("Prestige unlock")]
        public int prestigeUnlockStage = 10;   // prestige available once HighestStage ≥ this

        // ── Phase 7: prestige & artifacts ────────────────────────────
        [Header("Prestige / Relics — super-linear so the first Ascension is a real power jump")]
        public int    relicStartStage = 5;     // no relics before this stage
        [Tooltip("relics = floor(scale × max(0,stage-start)^power). power 1.6-1.9 = super-linear.")]
        public double relicScale = 1.6;
        public double relicPower = 1.8;
        [Header("Artifacts — first level is a big jump, later levels scale slower")]
        public double artifactBaseCost        = 10.0;   // in Relics
        public double artifactCostGrowth      = 1.5;
        [Tooltip("Bonus granted immediately at level 1 (e.g. 0.20 = +20%)")]
        public double artifactFirstLevelBonus = 0.20;
        [Tooltip("Additional flat bonus per level beyond level 1 (smaller than the first-level jump)")]
        public double artifactBonusPerLevel   = 0.04;

        // ── Phase 8: offline ─────────────────────────────────────────
        [Header("Offline")]
        public double offlineRate     = 0.5;   // fraction of fleet DPS credited while away
        public double offlineCapHours = 8.0;

        // ── Phase 10: monetization ───────────────────────────────────
        [Header("Monetization")]
        public float dailyResetHourUtc = 0f;   // daily reward resets at this UTC hour

        [Header("Daily reward — day 1..7 cycle, loops after day 7")]
        [Tooltip("Gold reward on day N = this stage's base kill gold × dailyGoldKillMultiples[N-1]")]
        public double[] dailyGoldKillMultiples = { 3, 4, 5, 6, 8, 10, 15 };
        [Tooltip("Day (1-7) that additionally grants a Relic, only once prestige is unlocked")]
        public int dailyRelicDay = 7;

        [Header("Skills — unlock levels & timing")]
        public int[] skillUnlockLevels = { 50, 100, 200, 300, 400, 500 };
        public float skillDurationSeconds = 30f;     // Meteor Strike is instant (see SkillType)

        [Header("Skill effect coefficients (effect = a×lvl + b)")]
        public float meteorPerLevel      = 70f;   // 70×(1+lvl)×tapDamage  (uses (1+lvl))
        public float droneTapsPerLevel   = 3f;    // 3×lvl + 4 taps/sec
        public float droneTapsBase       = 4f;
        public float targetingCritPerLvl = 3f;    // +(3×lvl + 41)% crit
        public float targetingCritBase   = 41f;
        public float battleCryDpsPerLvl  = 50f;   // +(50×lvl + 100)% DPS
        public float battleCryDpsBase    = 100f;
        public float overdriveTapPerLvl  = 30f;   // +(30×lvl + 40)% tap damage
        public float overdriveTapBase    = 40f;
        public float midasGoldPerLvl     = 5f;    // +(5×lvl + 10)% gold per tap
        public float midasGoldBase       = 10f;
    }
}
