using System.Collections.Generic;
using UnityEngine;

namespace StellarBreaker.Config
{
    public enum MissionType { DestroyPlanets, TapDamageTotal, ShipUpgrades }

    /// <summary>
    /// A one-shot quest: reach `target` progress on `type`'s counter, then claim `goldReward`.
    /// Not repeatable/rotating in this pass — matches the 3 missions shown in the UX mockup.
    /// </summary>
    [CreateAssetMenu(menuName = "StellarBreaker/MissionDefinition", fileName = "Mission")]
    public class MissionDefinition : ScriptableObject
    {
        public MissionType type;
        public string       displayName = "Mission";
        public double       target      = 1;
        public double       goldReward  = 0;

        public static MissionDefinition Create(MissionType type, string name, double target, double goldReward)
        {
            var m = CreateInstance<MissionDefinition>();
            m.type = type; m.displayName = name; m.target = target; m.goldReward = goldReward;
            return m;
        }
    }

    public static class MissionCatalog
    {
        /// <summary>The 3 missions from the datasheet/mockup. Fixed list, not randomized.</summary>
        public static List<MissionDefinition> BuildDefault()
        {
            return new List<MissionDefinition>
            {
                MissionDefinition.Create(MissionType.DestroyPlanets,  "Destroy 40 Planets",        40,        15000),
                MissionDefinition.Create(MissionType.TapDamageTotal,  "Deal 2,000,000 Tap Damage", 2_000_000, 40000),
                MissionDefinition.Create(MissionType.ShipUpgrades,    "Upgrade any Ship 5 times",  5,         25000),
            };
        }
    }
}
