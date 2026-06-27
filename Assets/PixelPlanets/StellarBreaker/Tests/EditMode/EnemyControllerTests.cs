using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;

namespace StellarBreaker.Tests
{
    /// <summary>Mockable IPlanetProvider — records spawn calls, no real generator.</summary>
    class FakePlanetProvider : IPlanetProvider
    {
        public readonly List<int> SpawnedStages = new List<int>();
        readonly List<GameObject> _created = new List<GameObject>();

        public event Action<GameObject> OnPlanetDestroyed;

        public GameObject SpawnPlanet(int stage)
        {
            SpawnedStages.Add(stage);
            // Replacing the previous planet raises the destroyed event (mirrors the real adapter).
            if (_created.Count > 0)
                OnPlanetDestroyed?.Invoke(_created[_created.Count - 1]);

            var go = new GameObject("FakePlanet_" + stage);
            _created.Add(go);
            return go;
        }

        public void Cleanup()
        {
            foreach (var go in _created)
                if (go != null) UnityEngine.Object.DestroyImmediate(go);
            _created.Clear();
        }
    }

    public class EnemyControllerTests
    {
        BalanceConfig _cfg;
        FakePlanetProvider _provider;

        [SetUp]
        public void SetUp()
        {
            _cfg = ScriptableObject.CreateInstance<BalanceConfig>();
            _provider = new FakePlanetProvider();
        }

        [TearDown]
        public void TearDown()
        {
            _provider.Cleanup();
            UnityEngine.Object.DestroyImmediate(_cfg);
        }

        [Test]
        public void Begin_Spawns_First_Planet_At_StartStage()
        {
            var ctrl = new EnemyController(_provider, _cfg, startStage: 1);
            ctrl.Begin();

            Assert.IsNotNull(ctrl.Current);
            Assert.IsNotNull(ctrl.CurrentView);
            Assert.AreEqual(1, ctrl.Stage);
            CollectionAssert.AreEqual(new[] { 1 }, _provider.SpawnedStages);
        }

        [Test]
        public void Killing_Planet_Advances_To_Next_Stage()
        {
            var ctrl = new EnemyController(_provider, _cfg, startStage: 1);
            int killed = 0;
            ctrl.OnPlanetKilled += _ => killed++;
            ctrl.Begin();

            ctrl.ApplyDamage(new BigNumber(1.0, 9)); // lethal

            Assert.AreEqual(1, killed);
            Assert.AreEqual(2, ctrl.Stage);
            CollectionAssert.AreEqual(new[] { 1, 2 }, _provider.SpawnedStages);
            Assert.IsFalse(ctrl.Current.IsDead); // freshly spawned next planet
        }

        [Test]
        public void Multiple_Kills_Chain_Stages()
        {
            var ctrl = new EnemyController(_provider, _cfg, startStage: 1);
            ctrl.Begin();

            for (int i = 0; i < 3; i++)
                ctrl.ApplyDamage(new BigNumber(1.0, 12)); // lethal each time

            Assert.AreEqual(4, ctrl.Stage);
            CollectionAssert.AreEqual(new[] { 1, 2, 3, 4 }, _provider.SpawnedStages);
        }

        [Test]
        public void Provider_Raises_Destroyed_Event_On_Replace()
        {
            int destroyedEvents = 0;
            _provider.OnPlanetDestroyed += _ => destroyedEvents++;

            var ctrl = new EnemyController(_provider, _cfg, startStage: 1);
            ctrl.Begin();                                  // spawn #1 (no destroy yet)
            ctrl.ApplyDamage(new BigNumber(1.0, 9));       // kill #1 → spawn #2 (destroys #1)

            Assert.AreEqual(1, destroyedEvents);
        }

        [Test]
        public void Null_Provider_Or_Config_Throws()
        {
            Assert.Throws<ArgumentNullException>(() => new EnemyController(null, _cfg));
            Assert.Throws<ArgumentNullException>(() => new EnemyController(_provider, null));
        }
    }
}
