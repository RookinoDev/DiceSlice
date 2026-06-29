using System;
using UnityEngine;
using StellarBreaker.Gameplay;

/// <summary>
/// Bridges StellarBreaker's IPlanetProvider to the existing PixelPlanetGenerator
/// WITHOUT modifying it. Lives in Assembly-CSharp so it can reference the generator
/// (the StellarBreaker asmdef cannot). The generator is auto-referenced back via asmdef.
///
/// Assumptions about the existing generator (verified against the current project):
///   • public void Reroll()                  → spawns a fresh planet
///   • public event System.Action OnSpawned  → fired after a planet is built
///   • the planet root is created as a child of the generator's transform,
///     named "Planet_&lt;type&gt;"
/// The generator does NOT take a stage today, so 'stage' is not consumed yet.
/// </summary>
[RequireComponent(typeof(PixelPlanetGenerator))]
public class PlanetGeneratorAdapter : MonoBehaviour, IPlanetProvider, IEnemyView
{
    [SerializeField] private PixelPlanetGenerator generator;

    private GameObject _current;
    private float      _punch;   // hit-reaction (decays to 0)

    public event Action<GameObject> OnPlanetDestroyed;

    void Awake()
    {
        if (generator == null) generator = GetComponent<PixelPlanetGenerator>();
        if (generator == null) generator = FindObjectOfType<PixelPlanetGenerator>();
    }

    // ── IEnemyView: hit reaction lives here, on the object that owns the planet root ──
    public void Punch() => _punch = 1f;

    void Update()
    {
        _punch = Mathf.MoveTowards(_punch, 0f, Time.deltaTime / 0.12f);
        if (_current != null) _current.transform.localScale = Vector3.one * (1f + 0.12f * _punch);
    }

    public GameObject SpawnPlanet(int stage)
    {
        // Notify that the previous planet is being replaced/destroyed.
        if (_current != null)
        {
            var old = _current;
            _current = null;
            OnPlanetDestroyed?.Invoke(old);
        }

        // TODO: wire `stage` into the generator (difficulty / type bias) once the
        // generator exposes such an input. For now Reroll() picks a random planet.
        if (generator != null) generator.Reroll();

        _current = FindSpawnedRoot();
        return _current;
    }

    // The generator parents its planet under itself as "Planet_*"; the newest child wins.
    private GameObject FindSpawnedRoot()
    {
        if (generator == null) return null;
        var t = generator.transform;
        for (int i = t.childCount - 1; i >= 0; i--)
        {
            var c = t.GetChild(i);
            if (c != null && c.name.StartsWith("Planet_"))
                return c.gameObject;
        }
        return null;
    }
}
