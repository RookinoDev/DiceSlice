namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Visual feedback hooks for the current enemy/target. Lets the HUD/gameplay trigger
    /// feedback without knowing anything about the concrete visual (PixelPlanetGenerator,
    /// or a future fantasy/hero sprite). The implementation owns the actual transform/effects.
    /// </summary>
    public interface IEnemyView
    {
        /// <summary>Brief hit reaction (scale punch / flash).</summary>
        void Punch();

        /// <summary>Destruction ceremony for the current target (burst/VFX). Call once, on kill.</summary>
        void Explode();
    }
}
