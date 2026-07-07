using UnityEngine;

namespace StellarBreaker.Config
{
    /// <summary>
    /// Static data for one ship. Combat is cooldown-based: every Cooldown seconds the
    /// ship deals HitDamage. Effective DPS = HitDamage / Cooldown.
    /// Per-level cost ×1.075, per-level damage ×1.27, cooldown breakpoints & milestones
    /// are global (BalanceConfig).
    /// </summary>
    [CreateAssetMenu(menuName = "StellarBreaker/ShipDefinition", fileName = "Ship")]
    public class ShipDefinition : ScriptableObject
    {
        public string        shipName     = "Ship";
        public string        className    = "";             // display-only fleet tier (Scout … Starbreaker)
        public Sprite        icon;
        public double        baseCost     = 50.0;            // level-1 buy cost
        public ShipArchetype archetype    = ShipArchetype.Fast;
        public double        baseCooldown = 0.5;            // seconds (from archetype)
        public double        baseDps      = 5.0;            // effective DPS @ lvl1
        public double        baseHitDamage = 2.5;          // = baseDps × baseCooldown

        public static ShipDefinition Create(string name, double baseCost,
                                            ShipArchetype archetype, double baseCooldown, double baseDps,
                                            string className = "")
        {
            var s = CreateInstance<ShipDefinition>();
            s.shipName      = name;
            s.className     = className;
            s.baseCost      = baseCost;
            s.archetype     = archetype;
            s.baseCooldown  = baseCooldown;
            s.baseDps       = baseDps;
            s.baseHitDamage = baseDps * baseCooldown;
            return s;
        }
    }
}
