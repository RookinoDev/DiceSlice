using System.Collections.Generic;
using UnityEngine;

namespace StellarBreaker.Config
{
    public enum SkillType
    {
        MeteorStrike,     // instant: 70×(1+lvl)×tapDamage
        DroneSwarm,       // 3×lvl+4 auto-taps/sec
        TargetingSystem,  // +(3×lvl+41)% crit
        BattleCry,        // +(50×lvl+100)% DPS
        Overdrive,        // +(30×lvl+40)% tap damage
        MidasBeam,        // +(5×lvl+10)% gold
    }

    /// <summary>One active skill: effect = coeffPerLevel×lvl + coeffBase (Meteor uses (1+lvl)).</summary>
    [CreateAssetMenu(menuName = "StellarBreaker/SkillDefinition", fileName = "Skill")]
    public class SkillDefinition : ScriptableObject
    {
        public SkillType type;
        public string    displayName = "Skill";
        [TextArea] public string description = "";   // sci-fi flavour shown in the HUD details line
        public int       unlockLevel = 50;
        public float     duration    = 30f;     // 0 = instant
        public float     cooldown    = 120f;
        public bool      isInstant   = false;
        public double    coeffPerLevel;         // 'a'
        public double    coeffBase;             // 'b'

        public static SkillDefinition Create(SkillType type, string name, int unlock,
                                             float duration, float cooldown, bool instant,
                                             double perLevel, double baseVal, string description = "")
        {
            var s = CreateInstance<SkillDefinition>();
            s.type = type; s.displayName = name; s.unlockLevel = unlock;
            s.duration = duration; s.cooldown = cooldown; s.isInstant = instant;
            s.coeffPerLevel = perLevel; s.coeffBase = baseVal;
            s.description = description;
            return s;
        }
    }

    /// <summary>Builds the 6 skills from BalanceConfig coefficients + unlock levels.</summary>
    public static class SkillCatalog
    {
        /// <summary>
        /// Prototype skills (all wired to real effects), low tap-level unlocks.
        /// Crit/Targeting is intentionally excluded (RNG would destabilise the deterministic
        /// damage pipeline) — it stays in the full catalog for later.
        /// </summary>
        public static List<SkillDefinition> BuildPrototype(BalanceConfig c)
        {
            return new List<SkillDefinition>
            {
                SkillDefinition.Create(SkillType.Overdrive,    "Overcharge", 3, 10f, 30f, false, c.overdriveTapPerLvl, c.overdriveTapBase, "Temporarily boosts Tap Cannon damage."),
                SkillDefinition.Create(SkillType.BattleCry,    "Surge",      5, 10f, 40f, false, c.battleCryDpsPerLvl, c.battleCryDpsBase, "Fleet Surge: temporarily boosts Fleet DPS."),
                SkillDefinition.Create(SkillType.MeteorStrike, "Meteor",     2, 0f,  20f, true,  c.meteorPerLevel,     0,                  "Meteor Strike: instant massive damage to the target."),
                SkillDefinition.Create(SkillType.DroneSwarm,   "Drones",     4, 10f, 35f, false, c.droneTapsPerLevel,  c.droneTapsBase,    "Drone Swarm: launches drones for temporary auto-fire."),
                SkillDefinition.Create(SkillType.MidasBeam,    "Harvest",    6, 12f, 45f, false, c.midasGoldPerLvl,    c.midasGoldBase,    "Cosmic Harvest: more Stardust from destroyed planets."),
            };
        }

        public static List<SkillDefinition> BuildDefault(BalanceConfig c)
        {
            int[] u = c.skillUnlockLevels;     // {50,100,200,300,400,500}
            int U(int i) => (u != null && i < u.Length) ? u[i] : (50 * (i + 1));
            float dur = c.skillDurationSeconds;
            float cd  = c.skillDefaultCooldown;

            return new List<SkillDefinition>
            {
                SkillDefinition.Create(SkillType.MeteorStrike,    "Meteor Strike",   U(0), 0f,  cd, true,  c.meteorPerLevel,      0,                     "Instant massive damage to the target."),
                SkillDefinition.Create(SkillType.DroneSwarm,      "Drone Swarm",     U(1), dur, cd, false, c.droneTapsPerLevel,   c.droneTapsBase,       "Launches drones for temporary auto-fire."),
                SkillDefinition.Create(SkillType.TargetingSystem, "Targeting Array", U(2), dur, cd, false, c.targetingCritPerLvl, c.targetingCritBase,   "Boosts critical-hit chance."),
                SkillDefinition.Create(SkillType.BattleCry,       "Fleet Surge",     U(3), dur, cd, false, c.battleCryDpsPerLvl,  c.battleCryDpsBase,    "Temporarily boosts Fleet DPS."),
                SkillDefinition.Create(SkillType.Overdrive,       "Overcharge",      U(4), dur, cd, false, c.overdriveTapPerLvl,  c.overdriveTapBase,    "Temporarily boosts Tap Cannon damage."),
                SkillDefinition.Create(SkillType.MidasBeam,       "Cosmic Harvest",  U(5), dur, cd, false, c.midasGoldPerLvl,     c.midasGoldBase,       "Increases Stardust from destroyed planets."),
            };
        }
    }
}
