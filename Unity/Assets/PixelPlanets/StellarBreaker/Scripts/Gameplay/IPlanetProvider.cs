using System;
using UnityEngine;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Visual planet source. Logic depends only on this abstraction, never on the
    /// concrete planet generator. The real implementation (PlanetGeneratorAdapter)
    /// lives in Assembly-CSharp and forwards to the existing PixelPlanetGenerator.
    /// </summary>
    public interface IPlanetProvider
    {
        /// <summary>Spawn/replace the visible planet for a stage; returns its root GameObject (may be null in tests).</summary>
        GameObject SpawnPlanet(int stage);

        /// <summary>Raised when a previously spawned planet's visual is removed.</summary>
        event Action<GameObject> OnPlanetDestroyed;
    }
}
