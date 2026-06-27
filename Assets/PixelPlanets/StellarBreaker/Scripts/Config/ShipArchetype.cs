namespace StellarBreaker.Config
{
    /// <summary>Combat role; sets base cooldown. Pattern repeats Fast→Medium→Heavy across the 19 ships.</summary>
    public enum ShipArchetype
    {
        Fast   = 0,  // 0.5s — light, frequent hits
        Medium = 1,  // 1.0s — balanced
        Heavy  = 2,  // 2.0s — big, slow burst (great vs bosses)
    }
}
