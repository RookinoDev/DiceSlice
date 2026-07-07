using System.Collections.Generic;
using UnityEngine;

namespace StellarBreaker.Config
{
    public enum ArtifactEffect { Dps, Gold, TapDamage }

    /// <summary>
    /// A permanent, Relic-bought multiplicative bonus.
    /// bonus(level) = firstLevelBonus + max(0, level-1) × bonusPerLevel   (level 1 = a big jump,
    /// each level after that adds a smaller flat amount); multiplier = 1 + bonus(level).
    /// cost(level) = baseCost × growth^(level-1) (Relics).
    /// </summary>
    [CreateAssetMenu(menuName = "StellarBreaker/ArtifactDefinition", fileName = "Artifact")]
    public class ArtifactDefinition : ScriptableObject
    {
        public ArtifactEffect effect;
        public string displayName = "Artifact";
        [TextArea] public string description = "";   // cosmic-tech flavour shown in the Artifacts panel
        public double baseCost          = 10.0;
        public double costGrowth        = 1.5;
        public double firstLevelBonus   = 0.20;   // granted immediately at level 1
        public double bonusPerLevel     = 0.04;   // additional flat bonus per level beyond 1

        public static ArtifactDefinition Create(ArtifactEffect effect, string name,
                                                double baseCost, double costGrowth,
                                                double firstLevelBonus, double bonusPerLevel,
                                                string description = "")
        {
            var a = CreateInstance<ArtifactDefinition>();
            a.effect = effect; a.displayName = name; a.description = description;
            a.baseCost = baseCost; a.costGrowth = costGrowth;
            a.firstLevelBonus = firstLevelBonus; a.bonusPerLevel = bonusPerLevel;
            return a;
        }

        /// <summary>Fractional bonus at a given level (0 for level ≤ 0). Single source of truth
        /// shared by ArtifactService.Multiplier and the Artifacts UI.</summary>
        public double BonusAt(int level)
            => level <= 0 ? 0.0 : firstLevelBonus + (level - 1) * bonusPerLevel;
    }

    public static class ArtifactCatalog
    {
        public static List<ArtifactDefinition> BuildDefault(BalanceConfig c)
        {
            return new List<ArtifactDefinition>
            {
                ArtifactDefinition.Create(ArtifactEffect.Dps,       "Singularity Core", c.artifactBaseCost,        c.artifactCostGrowth, c.artifactFirstLevelBonus, c.artifactBonusPerLevel, "Ancient reactor core. Increases total Fleet DPS."),
                ArtifactDefinition.Create(ArtifactEffect.Gold,      "Stellar Engine",   c.artifactBaseCost * 1.5,  c.artifactCostGrowth, c.artifactFirstLevelBonus, c.artifactBonusPerLevel, "Harvests dying stars. Increases Stardust gained."),
                ArtifactDefinition.Create(ArtifactEffect.TapDamage, "Kinetic Lens",     c.artifactBaseCost * 1.2,  c.artifactCostGrowth, c.artifactFirstLevelBonus, c.artifactBonusPerLevel, "Focuses kinetic fire. Increases Tap Cannon damage."),
            };
        }
    }
}
