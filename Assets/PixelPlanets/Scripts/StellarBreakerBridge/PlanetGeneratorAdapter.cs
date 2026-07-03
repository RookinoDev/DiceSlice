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
    private float      _punch;       // hit-reaction (decays to 0)
    private Vector3    _baseScale = Vector3.one;  // the planet's own scale (from the generator)
    private float       _popT = 1f;   // 0=just spawned (small) → 1=full size (pop-in ease)
    private const float PopDuration = 0.16f;

    public event Action<GameObject> OnPlanetDestroyed;

    void Awake()
    {
        if (generator == null) generator = GetComponent<PixelPlanetGenerator>();
        if (generator == null) generator = FindObjectOfType<PixelPlanetGenerator>();
    }

    // ── IEnemyView: hit reaction lives here, on the object that owns the planet root ──
    public void Punch() => _punch = 1f;

    // Destruction ceremony: a lightweight procedural particle burst at the target's
    // current position. Call BEFORE the planet is replaced (e.g. from GameSession.OnReward,
    // which fires while the dying planet is still the active _current). Mobile-safe:
    // short-lived, small particle count, self-destroys.
    public void Explode()
    {
        if (_current == null) return;
        var go = new GameObject("KillBurst");
        go.transform.position = _current.transform.position;

        var ps = go.AddComponent<ParticleSystem>();
        ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);  // cancel Unity's auto-play before configuring

        var main = ps.main;
        main.playOnAwake = false;
        main.loop = false;
        main.startLifetime = 0.35f;
        main.startSpeed = new ParticleSystem.MinMaxCurve(1.2f, 2.6f);
        main.startSize = new ParticleSystem.MinMaxCurve(0.08f, 0.22f);
        main.startColor = new Color(1f, 0.85f, 0.55f, 1f);
        main.stopAction = ParticleSystemStopAction.Destroy;

        var emission = ps.emission;
        emission.SetBursts(new[] { new ParticleSystem.Burst(0f, (short)18) });

        var shape = ps.shape;
        shape.shapeType = ParticleSystemShapeType.Sphere;
        shape.radius = 0.15f;

        var renderer = ps.GetComponent<ParticleSystemRenderer>();
        renderer.material = new Material(Shader.Find("Particles/Standard Unlit"));
        renderer.material.SetColor("_Color", main.startColor.color);

        ps.Play();
    }

    void Update()
    {
        _punch = Mathf.MoveTowards(_punch, 0f, Time.deltaTime / 0.12f);
        if (_popT < 1f) _popT = Mathf.Min(1f, _popT + Time.deltaTime / PopDuration);

        if (_current != null)
        {
            float pop = Mathf.Lerp(0.35f, 1f, Mathf.SmoothStep(0f, 1f, _popT));
            _current.transform.localScale = _baseScale * pop * (1f + 0.12f * _punch);
        }
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

        // Sector-linked target variety: force the biome by stage band, then reroll so
        // colour/rarity still vary within the band. Uses only the generator's public API.
        if (generator != null)
        {
            generator.useRandomType    = false;
            generator.forcedPlanetType = TypeForStage(stage);
            generator.Reroll();
        }

        _current = FindSpawnedRoot();

        // Cosmetic-only pop-in: the new target eases up from a small scale instead of
        // appearing instantly. Driven from Update() (see _popT) so it can't fight the
        // hit-punch scale. Purely visual — does not delay spawn/stage logic at all,
        // so it can't cause a gameplay lock or timing bug.
        if (_current != null)
        {
            _baseScale = _current.transform.localScale;
            _popT = 0f;
        }

        return _current;
    }

    // Display-only biome bands (mirror MainPresenter.ZoneName):
    //   <10 Outer Orbit (rocky) · <25 Red Belt (lava) · <50 Broken Moons (ice)
    //   <100 Void Frontier (chaotic/dark) · 100+ Stellar Core (gas giant)
    static PlanetType TypeForStage(int stage)
    {
        if (stage < 10)  return PlanetType.NoAtmosphere;
        if (stage < 25)  return PlanetType.LavaWorld;
        if (stage < 50)  return PlanetType.IceWorld;
        if (stage < 100) return PlanetType.Chaotic;
        return PlanetType.GasGiant;
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
