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
        public int       unlockLevel = 50;
        public float     duration    = 30f;     // 0 = instant
        public float     cooldown    = 120f;
        public bool      isInstant   = false;
        public double    coeffPerLevel;         // 'a'
        public double    coeffBase;             // 'b'

        public static SkillDefinition Create(SkillType type, string name, int unlock,
                                             float duration, float cooldown, bool instant,
                                             double perLevel, double baseVal)
        {
            var s = CreateInstance<SkillDefinition>();
            s.type = type; s.displayName = name; s.unlockLevel = unlock;
            s.duration = duration; s.cooldown = cooldown; s.isInstant = instant;
            s.coeffPerLevel = perLevel; s.coeffBase = baseVal;
            return s;
        }
    }

    /// <summary>Builds the 6 skills from BalanceConfig coefficients + unlock levels.</summary>
    public static class SkillCatalog
    {
        /// <summary>3 prototype skills with low, tap-level-based unlocks (Tap+, DPS+, Meteor).</summary>
        public static List<SkillDefinition> BuildPrototype(BalanceConfig c)
        {
            return new List<SkillDefinition>
            {
                SkillDefinition.Create(SkillType.Overdrive,    "Tap+",   3, 10f, 30f, false, c.overdriveTapPerLvl, c.overdriveTapBase),
                SkillDefinition.Create(SkillType.BattleCry,    "DPS+",   5, 10f, 40f, false, c.battleCryDpsPerLvl, c.battleCryDpsBase),
                SkillDefinition.Create(SkillType.MeteorStrike, "Meteor", 2, 0f,  20f, true,  c.meteorPerLevel,     0),
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
                SkillDefinition.Create(SkillType.MeteorStrike,    "Meteor Strike",    U(0), 0f,  cd, true,  c.meteorPerLevel,      0),
                SkillDefinition.Create(SkillType.DroneSwarm,      "Drone Swarm",      U(1), dur, cd, false, c.droneTapsPerLevel,   c.droneTapsBase),
                SkillDefinition.Create(SkillType.TargetingSystem, "Targeting System", U(2), dur, cd, false, c.targetingCritPerLvl, c.targetingCritBase),
                SkillDefinition.Create(SkillType.BattleCry,       "Battle Cry",       U(3), dur, cd, false, c.battleCryDpsPerLvl,  c.battleCryDpsBase),
                SkillDefinition.Create(SkillType.Overdrive,       "Overdrive",        U(4), dur, cd, false, c.overdriveTapPerLvl,  c.overdriveTapBase),
                SkillDefinition.Create(SkillType.MidasBeam,       "Midas Beam",       U(5), dur, cd, false, c.midasGoldPerLvl,     c.midasGoldBase),
            };
        }
    }
}
