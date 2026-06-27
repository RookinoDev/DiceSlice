using System;
using System.Collections.Generic;

namespace StellarBreaker.Config
{
    /// <summary>
    /// The 19-ship roster, fully from the datasheet:
    ///   • base COSTS = real "buy (Lvl 1)" column (aa = 1e15),
    ///   • archetype pattern Fast→Medium→Heavy repeating (cooldowns 0.5/1.0/2.0),
    ///   • base effective DPS chain: ship1 = 5, each next ×1.27^10 (≈×10.92),
    ///   • base Hit Damage = baseDps × cooldown.
    /// These mirror BalanceConfig defaults and stay parametric (change 1.27 / first DPS to rebalance).
    /// </summary>
    public static class ShipCatalog
    {
        // Real datasheet base costs (Lvl-1 buy). aa = 1e15.
        static readonly double[] BaseCosts =
        {
            50, 175, 674, 2_850, 13_300, 68_100, 384_000, 2_680_000, 23_800_000,
            143_000_000, 694_000_000, 6_840_000_000, 54_700_000_000, 820_000_000_000,
            8_200_000_000_000, 164_000_000_000_000, 1.64e15, 4.95e16, 2.46e17,
        };

        const double FirstDps        = 5.0;
        const double DamagePerLevel  = 1.27;
        const int    ChainLevels     = 10;                         // "next ship ≈ prev at lvl 10"
        static readonly double ChainFactor = Math.Pow(DamagePerLevel, ChainLevels); // ≈10.92
        static readonly double[] Cooldowns = { 0.5, 1.0, 2.0 };    // Fast, Medium, Heavy

        public static List<ShipDefinition> BuildDefault()
        {
            var list = new List<ShipDefinition>(BaseCosts.Length);
            double dps = FirstDps;
            for (int k = 0; k < BaseCosts.Length; k++)
            {
                var archetype = (ShipArchetype)(k % 3);
                double cd     = Cooldowns[k % 3];
                list.Add(ShipDefinition.Create($"Ship {k + 1}", BaseCosts[k], archetype, cd, dps));
                dps *= ChainFactor;
            }
            return list;
        }
    }
}
