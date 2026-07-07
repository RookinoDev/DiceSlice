using System;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Host for the active planet's model + visual. It does NOT decide progression:
    /// StageManager is the authority. The controller spawns the planet for whatever
    /// stage StageManager enters, and on death simply notifies StageManager, which
    /// decides the next stage (normal advance / boss clear / boss stay).
    /// </summary>
    public class EnemyController
    {
        readonly IPlanetProvider _provider;
        readonly StageManager    _stage;

        public Planet       Current     { get; private set; }
        public GameObject   CurrentView { get; private set; }
        public int          Stage  => _stage.CurrentStage;
        public StageManager Stages => _stage;

        public event Action<Planet> OnPlanetSpawned;
        public event Action<Planet> OnPlanetKilled;

        /// <summary>Primary: StageManager is the single progression authority.</summary>
        public EnemyController(IPlanetProvider provider, StageManager stage)
        {
            _provider = provider ?? throw new ArgumentNullException(nameof(provider));
            _stage    = stage    ?? throw new ArgumentNullException(nameof(stage));
            _stage.OnStageEntered += SpawnForStage;
        }

        /// <summary>Convenience: builds an internal StageManager (isolated tests / simple use).</summary>
        public EnemyController(IPlanetProvider provider, BalanceConfig cfg, int startStage = 1)
            : this(provider, new StageManager(cfg ?? throw new ArgumentNullException(nameof(cfg)), startStage)) { }

        /// <summary>Enter the starting stage (spawns the first planet via StageManager).</summary>
        public void Begin() => _stage.Begin();

        public void ApplyDamage(BigNumber damage) => Current?.ApplyDamage(damage);

        /// <summary>Respawn the current stage's planet at full HP (e.g. after a boss fail).</summary>
        public void Respawn() => SpawnForStage(_stage.CurrentStage);

        void SpawnForStage(int stage)
        {
            if (Current != null) Current.OnDestroyed -= HandleDestroyed;
            CurrentView = _provider.SpawnPlanet(stage);
            Current     = new Planet(stage, _stage.HpFor(stage), _stage.IsBossStage(stage));
            Current.OnDestroyed += HandleDestroyed;
            OnPlanetSpawned?.Invoke(Current);
        }

        void HandleDestroyed(Planet planet)
        {
            planet.OnDestroyed -= HandleDestroyed;
            OnPlanetKilled?.Invoke(planet);
            _stage.NotifyPlanetKilled();   // authority decides next stage → OnStageEntered → SpawnForStage
        }
    }
}
