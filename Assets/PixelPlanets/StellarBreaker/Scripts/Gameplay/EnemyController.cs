using System;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Scene-independent coordinator: owns the current Planet model + its visual
    /// (via IPlanetProvider). Routes damage in, advances to the next stage when a
    /// planet dies. Pure logic — drivable from tests with a fake provider.
    /// </summary>
    public class EnemyController
    {
        readonly IPlanetProvider _provider;
        readonly BalanceConfig   _cfg;

        public Planet     Current     { get; private set; }
        public GameObject CurrentView { get; private set; }
        public int        Stage       { get; private set; }

        public event Action<Planet> OnPlanetSpawned;
        public event Action<Planet> OnPlanetKilled;

        public EnemyController(IPlanetProvider provider, BalanceConfig cfg, int startStage = 1)
        {
            _provider = provider ?? throw new ArgumentNullException(nameof(provider));
            _cfg      = cfg      ?? throw new ArgumentNullException(nameof(cfg));
            Stage     = Mathf.Max(1, startStage);
        }

        /// <summary>Spawn the first planet for the starting stage.</summary>
        public void Begin() => Spawn(Stage);

        /// <summary>Apply tap/DPS damage to the current planet.</summary>
        public void ApplyDamage(BigNumber damage) => Current?.ApplyDamage(damage);

        void Spawn(int stage)
        {
            Stage       = stage;
            CurrentView = _provider.SpawnPlanet(stage);
            Current     = Planet.Create(stage, _cfg);
            Current.OnDestroyed += HandleDestroyed;
            OnPlanetSpawned?.Invoke(Current);
        }

        void HandleDestroyed(Planet planet)
        {
            planet.OnDestroyed -= HandleDestroyed;
            OnPlanetKilled?.Invoke(planet);
            Spawn(Stage + 1);   // request next
        }
    }
}
