using System.Collections.Generic;
using UnityEngine;

namespace StellarBreaker.Config
{
    public enum ArtifactEffect { Dps, Gold, TapDamage }

    /// <summary>
    /// A permanent, Relic-bought multiplicative bonus.
    /// multiplier = 1 + level × bonusPerLevel; cost(level) = baseCost × growth^level (Relics).
    /// </summary>
    [CreateAssetMenu(menuName = "StellarBreaker/ArtifactDefinition", fileName = "Artifact")]
    public class ArtifactDefinition : ScriptableObject
    {
        public ArtifactEffect effect;
        public string displayName = "Artifact";
        public double baseCost      = 10.0;
        public double costGrowth    = 1.5;
        public double bonusPerLevel = 0.05;

        public static ArtifactDefinition Create(ArtifactEffect effect, string name,
                                                double baseCost, double costGrowth, double bonusPerLevel)
        {
            var a = CreateInstance<ArtifactDefinition>();
            a.effect = effect; a.displayName = name;
            a.baseCost = baseCost; a.costGrowth = costGrowth; a.bonusPerLevel = bonusPerLevel;
            return a;
        }
    }

    public static class ArtifactCatalog
    {
        public static List<ArtifactDefinition> BuildDefault(BalanceConfig c)
        {
            return new List<ArtifactDefinition>
            {
                ArtifactDefinition.Create(ArtifactEffect.Dps,       "Singularity Core", c.artifactBaseCost,        c.artifactCostGrowth, c.artifactBonusPerLevel),
                ArtifactDefinition.Create(ArtifactEffect.Gold,      "Midas Fragment",   c.artifactBaseCost * 1.5,  c.artifactCostGrowth, c.artifactBonusPerLevel),
                ArtifactDefinition.Create(ArtifactEffect.TapDamage, "Kinetic Lens",     c.artifactBaseCost * 1.2,  c.artifactCostGrowth, c.artifactBonusPerLevel),
            };
        }
    }
}
