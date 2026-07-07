using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class PixelPlanetGenerator : MonoBehaviour
{
    [Header("Generation")]
    public bool       randomizeOnPlay  = true;
    public bool       useRandomType    = true;
    public PlanetType forcedPlanetType = PlanetType.TerranWet;
    public int        seed             = 42;

    [Header("Appearance")]
    public int     pixelSize     = 100;   // base pixel count; scales with planet size
    public float   rotationSpeed = 1f;    // multiplier on per-type rotation rate
    public bool    dither        = true;
    public Vector2 lightPosition = new Vector2(0.39f, 0.39f);

    // ── Runtime ──────────────────────────────────────────────────────
    Material[] _mats;
    float[]    _timeRates;
    float[]    _rotOffsets;  // per-material extra rotation (e.g. ring +0.7)
    float      _baseRot;     // random starting tilt
    float      _animRot;     // grows each frame
    float      _rotRate;     // rad/s for this planet type
    float      _time = 1000f;
    float      _scale;       // planet world-space scale (0.9 – 1.9)
    bool       _chaosColors; // Chaotic type: replace curated theme with random colors
    Color      _starTint;    // colour of this system's star — tints all surface colours
    float      _starStrength;// how strongly the star colours the planet (0 = white light)
    bool       _proceduralColors; // use HSV-generated palette instead of a curated theme
    bool       _legendary;   // current planet is Legendary → special effect layers
    bool       _portrait;    // screen taller than wide → reorient moon orbits vertically
    const float OrthoSize = 2.5f;   // camera half-height (world units)
    Material   _bgMat;       // persistent space-background material
    Transform  _bgTr;        // background quad transform (sized to viewport)
    float      _starHalfW = 4f, _starHalfH = 2.75f; // star scatter bounds (viewport-based)
    Text       _nameLabel;   // on-screen procedural name
    GameObject _root;

    // ── Orbiting moons ───────────────────────────────────────────────
    struct Moon { public Transform tr; public Material[] mats; public float ax, ay, speed, phase, baseScale; }
    readonly List<Moon> _moons = new List<Moon>();

    // ── Background star sprites (optional PNGs in Resources/Stars) ────
    class BgStar { public Transform tr; public Material mat; public Color baseCol;
                   public float baseScale, phase, twSpeed, drift, x0, y; }
    readonly List<BgStar> _bgStars = new List<BgStar>();
    Texture2D[] _starTextures;
    Shader      _starShader;

    // ── Public API for tweaker UI ─────────────────────────────────
    public event System.Action          OnSpawned;
    public Material[]                   CurrentMats => _mats;
    public PlanetType                   CurrentType { get; private set; }
    public string                       CurrentRarity { get; private set; }
    public Color                        CurrentRarityColor { get; private set; }
    public string                       CurrentName { get; private set; }

    // ── Shorthand ────────────────────────────────────────────────────
    static Color C(float r, float g, float b) => new Color(r, g, b);

    // ── Shared project font (Resources/Youre Gone.otf) ───────────────
    static Font _customFont;
    public static Font CustomFont
    {
        get
        {
            if (_customFont == null) _customFont = Resources.Load<Font>("MotionControl-BoldItalic");
            return _customFont
                ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")
                ?? Resources.GetBuiltinResource<Font>("Arial.ttf");
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  STEP 1 — Color Themes  (curated palettes per planet type)
    // ═══════════════════════════════════════════════════════════════
    // Layout per entry: [water×3 | land×4 | cloud×4]  for TerranWet / IceWorld
    //                   [ground×3 | crater×2]           for NoAtmosphere
    //                   [light×3  | dark×3]             for GasGiant
    //                   [ground×3 | crater×2 | lava×3]  for LavaWorld

    static readonly Color[][] ThemesTerran =
    {
        // Earth
        new[]{ C(.05f,.12f,.40f),C(.08f,.20f,.55f),C(.03f,.06f,.22f),
               C(.10f,.30f,.10f),C(.18f,.48f,.16f),C(.35f,.58f,.22f),C(.62f,.55f,.28f),
               C(.90f,.92f,.95f),C(.75f,.78f,.85f),C(.58f,.63f,.72f),C(.40f,.44f,.52f) },
        // Alien Ocean
        new[]{ C(.28f,.05f,.45f),C(.40f,.10f,.60f),C(.15f,.02f,.28f),
               C(.05f,.45f,.48f),C(.08f,.60f,.55f),C(.12f,.72f,.60f),C(.08f,.80f,.65f),
               C(.92f,.75f,.88f),C(.78f,.60f,.78f),C(.62f,.45f,.65f),C(.45f,.30f,.50f) },
        // Tropical
        new[]{ C(.05f,.55f,.65f),C(.08f,.42f,.55f),C(.03f,.30f,.45f),
               C(.15f,.55f,.08f),C(.28f,.70f,.12f),C(.50f,.80f,.10f),C(.75f,.72f,.20f),
               C(.95f,.95f,.88f),C(.88f,.88f,.78f),C(.78f,.80f,.70f),C(.65f,.68f,.60f) },
        // Desert World
        new[]{ C(.60f,.45f,.08f),C(.72f,.58f,.15f),C(.45f,.32f,.05f),
               C(.50f,.18f,.05f),C(.38f,.12f,.04f),C(.28f,.08f,.03f),C(.18f,.05f,.02f),
               C(.88f,.80f,.68f),C(.78f,.68f,.55f),C(.65f,.55f,.40f),C(.50f,.40f,.28f) },
    };

    static readonly Color[][] ThemesNoAtmo =
    {
        // Moon
        new[]{ C(.72f,.72f,.72f),C(.55f,.55f,.55f),C(.30f,.30f,.30f),
               C(.48f,.48f,.48f),C(.22f,.22f,.22f) },
        // Mars
        new[]{ C(.65f,.28f,.12f),C(.50f,.20f,.08f),C(.32f,.12f,.05f),
               C(.42f,.15f,.06f),C(.22f,.06f,.02f) },
        // Alien Teal
        new[]{ C(.08f,.45f,.42f),C(.05f,.32f,.30f),C(.02f,.18f,.18f),
               C(.06f,.36f,.34f),C(.02f,.12f,.12f) },
        // Obsidian
        new[]{ C(.22f,.18f,.28f),C(.14f,.11f,.18f),C(.07f,.05f,.09f),
               C(.18f,.14f,.22f),C(.06f,.04f,.08f) },
    };

    static readonly Color[][] ThemesGas =
    {
        // Saturn
        new[]{ C(.88f,.82f,.62f),C(.78f,.68f,.48f),C(.62f,.52f,.32f),
               C(.45f,.35f,.20f),C(.28f,.20f,.10f),C(.15f,.10f,.04f) },
        // Jupiter
        new[]{ C(.90f,.72f,.55f),C(.80f,.55f,.38f),C(.65f,.38f,.22f),
               C(.45f,.22f,.10f),C(.28f,.10f,.04f),C(.15f,.05f,.01f) },
        // Neptune
        new[]{ C(.28f,.52f,.90f),C(.18f,.38f,.72f),C(.10f,.24f,.55f),
               C(.06f,.14f,.38f),C(.03f,.07f,.22f),C(.01f,.03f,.12f) },
        // Toxic
        new[]{ C(.55f,.85f,.25f),C(.40f,.68f,.15f),C(.25f,.50f,.08f),
               C(.12f,.32f,.04f),C(.06f,.18f,.01f),C(.02f,.08f,.00f) },
        // Purple Giant
        new[]{ C(.68f,.28f,.88f),C(.52f,.16f,.70f),C(.36f,.08f,.52f),
               C(.22f,.04f,.35f),C(.12f,.01f,.20f),C(.05f,.00f,.10f) },
    };

    static readonly Color[][] ThemesIce =
    {
        // Arctic Blue
        new[]{ C(.82f,.88f,.95f),C(.65f,.75f,.88f),C(.48f,.60f,.78f),
               C(.30f,.50f,.75f),C(.18f,.35f,.60f),C(.08f,.20f,.45f),
               C(.96f,.97f,1.0f),C(.82f,.88f,.96f),C(.66f,.75f,.88f),C(.50f,.60f,.76f) },
        // Frozen Crystal
        new[]{ C(.72f,.90f,.92f),C(.52f,.76f,.82f),C(.32f,.60f,.72f),
               C(.08f,.50f,.60f),C(.04f,.34f,.45f),C(.01f,.18f,.30f),
               C(.92f,.96f,.92f),C(.78f,.86f,.80f),C(.62f,.74f,.66f),C(.45f,.60f,.52f) },
        // Blizzard
        new[]{ C(.90f,.91f,.94f),C(.76f,.78f,.84f),C(.60f,.63f,.72f),
               C(.42f,.48f,.62f),C(.26f,.30f,.45f),C(.12f,.14f,.28f),
               C(.98f,.98f,.98f),C(.88f,.88f,.90f),C(.75f,.75f,.80f),C(.60f,.60f,.68f) },
    };

    static readonly Color[][] ThemesLava =
    {
        // Classic Lava
        new[]{ C(.22f,.15f,.10f),C(.14f,.09f,.05f),C(.07f,.04f,.02f),
               C(.16f,.10f,.06f),C(.06f,.03f,.01f),
               C(.95f,.55f,.05f),C(.80f,.30f,.01f),C(.55f,.10f,.00f) },
        // Alien Lava
        new[]{ C(.10f,.08f,.22f),C(.06f,.05f,.15f),C(.03f,.02f,.08f),
               C(.08f,.06f,.18f),C(.03f,.02f,.08f),
               C(.05f,.90f,.80f),C(.02f,.65f,.58f),C(.01f,.40f,.35f) },
        // Inferno
        new[]{ C(.10f,.05f,.02f),C(.06f,.02f,.01f),C(.02f,.01f,.00f),
               C(.08f,.03f,.01f),C(.02f,.01f,.00f),
               C(1.0f,.85f,.02f),C(.95f,.50f,.01f),C(.75f,.18f,.00f) },
    };


    // Layout: [color×3]  shadow | mid | highlight
    static readonly Color[][] ThemesAsteroid =
    {
        // Rocky grey
        new[]{ C(.18f,.17f,.16f),C(.42f,.40f,.38f),C(.62f,.60f,.58f) },
        // Mars iron
        new[]{ C(.28f,.10f,.05f),C(.52f,.22f,.10f),C(.72f,.38f,.18f) },
        // Dark metallic
        new[]{ C(.08f,.08f,.10f),C(.22f,.22f,.28f),C(.40f,.40f,.50f) },
        // Sandy
        new[]{ C(.35f,.28f,.14f),C(.58f,.48f,.28f),C(.78f,.68f,.45f) },
    };

    // ═══════════════════════════════════════════════════════════════
    //  Lifecycle
    // ═══════════════════════════════════════════════════════════════
    void Start()
    {
        if (randomizeOnPlay) seed = Random.Range(0, 100000);
        EnsureCameraOutline();
        CreateBackground();
        CreateStarField();
        CreateRerollButton();
        CreateNameLabel();
        if (GetComponent<PlanetTweakerUI>() == null)
            gameObject.AddComponent<PlanetTweakerUI>();
        Spawn();
    }

    static void EnsureCameraOutline()
    {
        var cam = Camera.main;
        if (cam == null) return;
        if (cam.GetComponent<CameraOutline>() == null)
            cam.gameObject.AddComponent<CameraOutline>();
    }

    void Update()
    {
        if (_bgMat != null) _bgMat.SetFloat("_PlanetTime", Time.time);

        // Background star sprites: slow parallax drift + twinkle
        for (int i = 0; i < _bgStars.Count; i++)
        {
            var st = _bgStars[i];
            if (st.tr == null) continue;
            float minX = -_starHalfW, range = 2f * _starHalfW;
            float x = st.x0 + Time.time * st.drift;
            x = ((x - minX) % range + range) % range + minX;   // wrap horizontally
            st.tr.localPosition = new Vector3(x, st.y, 0f);
            float tw = 0.65f + 0.35f * Mathf.Sin(Time.time * st.twSpeed + st.phase);
            st.mat.SetColor("_Color", st.baseCol * tw);
            st.tr.localScale = Vector3.one * st.baseScale * (0.92f + 0.08f * tw);
        }

        if (_mats == null) return;

        // STEP 3 — animate rotation every frame
        _animRot += Time.deltaTime * _rotRate * rotationSpeed;
        _time    += Time.deltaTime;

        for (int i = 0; i < _mats.Length; i++)
        {
            if (_mats[i] == null) continue;
            _mats[i].SetFloat("_PlanetTime", _time * _timeRates[i]);
            _mats[i].SetFloat("_Rotation",   _baseRot + _animRot + _rotOffsets[i]);
        }

        // Orbit moons around the planet (tilted ellipse + front/back via render queue)
        for (int i = 0; i < _moons.Count; i++)
        {
            var mn = _moons[i];
            if (mn.tr == null) continue;
            float ang   = _time * mn.speed + mn.phase;
            float depth = Mathf.Sin(ang);                       // +front … -behind
            float x  = Mathf.Cos(ang) * mn.ax;
            float y  = Mathf.Sin(ang) * mn.ay;
            mn.tr.localPosition = new Vector3(x, y, 0f);
            float persp = 0.85f + 0.15f * depth;                // subtle depth
            mn.tr.localScale = new Vector3(mn.baseScale * persp, mn.baseScale * persp, 1f);
            // whole moon goes behind or in front of the planet; +j keeps craters over surface
            int baseQ = depth < 0f ? 2980 : 3200;
            for (int j = 0; j < mn.mats.Length; j++)
                if (mn.mats[j] != null) mn.mats[j].renderQueue = baseQ + j;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Spawn
    // ═══════════════════════════════════════════════════════════════
    public void Reroll()
    {
        seed = Random.Range(0, 100000);
        Spawn();
    }

    void Spawn()
    {
        if (_root != null) Destroy(_root);

        Random.InitState(seed);
        _animRot = 0f;
        _time    = 1000f;

        // Asteroid (5) disabled. Random pool = 5 base types (0..4) + Chaotic (random colors).
        PlanetType type;
        if (useRandomType)
        {
            int roll = Random.Range(0, (int)PlanetType.Asteroid + 1); // 0..5
            type = (roll == (int)PlanetType.Asteroid)                 // 5 → Chaotic slot
                 ? PlanetType.Chaotic
                 : (PlanetType)roll;
        }
        else type = forcedPlanetType;

        // Chaotic: spawn a random base type but with fully random colors instead of a theme
        _chaosColors = (type == PlanetType.Chaotic);
        PlanetType spawnType = _chaosColors
            ? (PlanetType)Random.Range(0, (int)PlanetType.Asteroid) // 0..4
            : type;

        // ── Rarity roll: 80% Common, 17% Rare, 3% Legendary ──────────
        float rRoll = Random.value;
        int rarity = rRoll < 0.80f ? 0 : (rRoll < 0.97f ? 1 : 2);
        switch (rarity)
        {
            case 0: CurrentRarity = "COMMON";    CurrentRarityColor = new Color(.70f,.74f,.82f); break;
            case 1: CurrentRarity = "RARE";      CurrentRarityColor = new Color(.45f,.72f,1.0f); break;
            default:CurrentRarity = "LEGENDARY"; CurrentRarityColor = new Color(1.0f,.78f,.28f); break;
        }
        _legendary = (rarity == 2);

        // ── Star colour: exotic chance rises with rarity ─────────────
        _starTint = Color.white; _starStrength = 0f;
        float starChance = rarity == 0 ? 0.45f : (rarity == 1 ? 0.75f : 1.0f);
        if (Random.value < starChance) PickStarTint(rarity);

        // ── Palette: Legendary always procedural; otherwise 40% chance
        _proceduralColors = !_chaosColors && (rarity == 2 || Random.value < 0.40f);

        // Procedural name + refresh space background (nebula tinted by the star)
        CurrentName = GenName();
        if (_nameLabel != null) _nameLabel.text = CurrentName;
        RefreshBackground();
        RefreshStarField();

        // ── Size the planet to fit the SMALLER screen dimension ───────
        // Planet disc diameter ≈ 1.8*_scale world units. We clamp it to a
        // fraction of the narrower visible axis so it never overflows on a
        // portrait phone, nor looks tiny on a wide screen.
        float aspect = Camera.main != null ? Camera.main.aspect : (1080f / 1920f);
        _portrait    = aspect < 1f;
        float visMin = 2f * OrthoSize * Mathf.Min(aspect, 1f);   // min(width, height)
        float dia    = Random.Range(visMin * 0.42f, visMin * 0.70f) * (rarity == 2 ? 1.05f : 1f);
        dia          = Mathf.Min(dia, visMin * 0.76f);           // hard cap so it always fits
        _scale       = dia / 1.8f;
        _baseRot     = Random.Range(0f, 6.2832f);

        // Randomize light direction — angle-based so distance from centre is consistent
        float lightAngle = Random.Range(0f, Mathf.PI * 2f);
        float lightDist  = Random.Range(0.18f, 0.34f);
        lightPosition = new Vector2(
            0.5f + Mathf.Cos(lightAngle) * lightDist,
            0.5f + Mathf.Sin(lightAngle) * lightDist);

        _root = new GameObject("Planet_" + type);
        _root.transform.SetParent(transform);
        _root.transform.localPosition = Vector3.zero;

        ConfigureCamera();

        float cSeed = (seed % 1000) / 100f;

        _moons.Clear();

        switch (spawnType)
        {
            case PlanetType.TerranWet:    SpawnTerranWet(cSeed);    break;
            case PlanetType.NoAtmosphere: SpawnNoAtmosphere(cSeed); break;
            case PlanetType.GasGiant:     SpawnGasGiant(cSeed);     break;
            case PlanetType.IceWorld:     SpawnIceWorld(cSeed);     break;
            case PlanetType.LavaWorld:    SpawnLavaWorld(cSeed);    break;
            case PlanetType.Asteroid:     SpawnAsteroid(cSeed);     break;
        }

        // ── Extras: rings & moons (probability scales with rarity) ───
        float ringChance = rarity == 0 ? 0.10f : (rarity == 1 ? 0.35f : 0.85f);
        if (spawnType != PlanetType.GasGiant && spawnType != PlanetType.Asteroid
            && Random.value < ringChance)
            AddRing(cSeed);

        int maxMoons = rarity == 0 ? 1 : (rarity == 1 ? 2 : 3);
        int moonCount = Random.Range(0, maxMoons + 1);
        if (rarity == 2) moonCount = Mathf.Max(moonCount, 1);  // Legendary always has a moon
        for (int i = 0; i < moonCount; i++) AddMoon(cSeed, i);

        // Tweaker uses the underlying base type so its parameter sliders still apply
        CurrentType = spawnType;
        OnSpawned?.Invoke();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Camera
    // ═══════════════════════════════════════════════════════════════
    void ConfigureCamera()
    {
        Camera cam = Camera.main;
        if (cam == null) return;
        cam.orthographic     = true;
        cam.orthographicSize = OrthoSize;
        cam.backgroundColor  = new Color(0.04f, 0.04f, 0.08f);
        cam.clearFlags       = CameraClearFlags.SolidColor;
        cam.transform.position = new Vector3(0, 0, -10);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Layer / material helpers
    // ═══════════════════════════════════════════════════════════════
    GameObject MakeLayer(string name, Material mat, int queue, float scaleMultiplier = 1f)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
        go.name = name;
        go.transform.SetParent(_root.transform);
        go.transform.localPosition = Vector3.zero;
        // STEP 2 — world-space scale uses _scale
        float s = 1.8f * _scale * scaleMultiplier;
        go.transform.localScale = new Vector3(s, s, 1f);
        Destroy(go.GetComponent<Collider>());
        mat.renderQueue = queue;
        go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        return go;
    }

    Material MakeMat(string shaderName, float cSeed, float size = 50f)
    {
        var sh = Shader.Find("PixelPlanets/" + shaderName);
        if (!sh) { Debug.LogError("Shader not found: PixelPlanets/" + shaderName); return null; }
        var mat = new Material(sh);
        int px = Mathf.Clamp(Mathf.RoundToInt(pixelSize * _scale), 50, 180);
        mat.SetFloat("_Pixels",       px);
        mat.SetVector("_LightOrigin", new Vector4(lightPosition.x, lightPosition.y, 0, 0));
        mat.SetFloat("_Seed",         Mathf.Max(0.01f, cSeed));
        mat.SetFloat("_Size",         size);
        mat.SetInt  ("_Octaves",      4);
        mat.SetInt  ("_ShouldDither", dither ? 1 : 0);
        mat.SetFloat("_Rotation",     _baseRot);
        return mat;
    }

    float TR(float factor) => (2f * Mathf.Round(50f) / 0.2f) * factor; // time rate helper

    void InitArrays(int count)
    {
        _mats       = new Material[count];
        _timeRates  = new float[count];
        _rotOffsets = new float[count];
        // default: no extra offset
        for (int i = 0; i < count; i++) _rotOffsets[i] = 0f;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Planet types
    // ═══════════════════════════════════════════════════════════════

    // ── TerranWet ────────────────────────────────────────────────
    void SpawnTerranWet(float s)
    {
        _rotRate = 0.06f;
        InitArrays(3);

        Color[] t = PickTheme(ThemesTerran, PlanetType.TerranWet);

        // Terrain size: controls continent scale (small=many islands, large=few big landmasses)
        float terrainSize = Random.Range(28f, 78f);
        float cloudSize   = Random.Range(22f, 70f);  // independent from terrain

        var wMat  = MakeMat("PlanetUnder",    s, terrainSize);
        var lMat  = MakeMat("PlanetLandmass", s, terrainSize);
        var clMat = MakeMat("PlanetClouds",   s, cloudSize);

        wMat .SetColorArray("_Colors", Slice(t, 0, 3));
        lMat .SetColorArray("_Colors", Slice(t, 3, 4));
        lMat .SetFloat("_LandCutoff",  Random.Range(0.20f, 0.70f));  // wide: archipelago → supercontinent
        clMat.SetColorArray("_Colors", Slice(t, 7, 4));
        SetRandomCloudStyle(clMat);

        _mats[0]=wMat; _mats[1]=lMat; _mats[2]=clMat;
        _timeRates[0]=TR(0.02f); _timeRates[1]=TR(0.02f); _timeRates[2]=TR(0.01f);

        MakeLayer("Water", wMat,  3000);
        MakeLayer("Land",  lMat,  3001);
        MakeLayer("Cloud", clMat, 3002);

        // Legendary: city lights on the night side + occasional aurora
        if (_legendary)
        {
            var cl = AddEffectLayer("CityLights", s, terrainSize, 3003, TR(0.02f));
            if (cl != null) cl.SetColor("_CityColor", new Color(1.0f, 0.78f, 0.42f));
            if (Random.value < 0.6f) AddEffectLayer("Aurora", s, terrainSize, 3004, TR(0.01f));
        }
    }

    // ── NoAtmosphere ─────────────────────────────────────────────
    void SpawnNoAtmosphere(float s)
    {
        _rotRate = 0.025f;
        InitArrays(2);

        Color[] t = PickTheme(ThemesNoAtmo, PlanetType.NoAtmosphere);

        float terrainSize = Random.Range(28f, 78f);
        float craterSize  = Random.Range(2f, 20f);   // _Size = crater COUNT (matches UI 2..20)

        var gMat = MakeMat("NoAtmosphere",  s, terrainSize);
        var cMat = MakeMat("PlanetCraters", s, craterSize);

        gMat.SetColorArray("_Colors", Slice(t, 0, 3));
        cMat.SetColorArray("_Colors", Slice(t, 3, 2));
        // Crater Speed: only 10% chance above 0.20
        cMat.SetFloat("_TimeSpeed", (Random.value < 0.10f)
            ? Random.Range(0.20f, 0.60f) : Random.Range(0.00f, 0.20f));

        _mats[0]=gMat; _mats[1]=cMat;
        _timeRates[0]=TR(0.02f); _timeRates[1]=TR(0.02f);

        MakeLayer("Ground",  gMat, 3000);
        MakeLayer("Craters", cMat, 3001);
    }

    // ── GasGiant ─────────────────────────────────────────────────
    void SpawnGasGiant(float s)
    {
        _rotRate = 0.18f;
        InitArrays(2);

        Color[] t = PickTheme(ThemesGas, PlanetType.GasGiant);

        float gasSize = Random.Range(35f, 72f);
        var gMat = MakeMat("GasLayers",  s, gasSize);
        var rMat = MakeMat("PlanetRing", s);

        Color[] light = Slice(t, 0, 3);
        Color[] dark  = Slice(t, 3, 3);

        gMat.SetColorArray("_Colors",     light);
        gMat.SetColorArray("_DarkColors", dark);
        gMat.SetFloat("_CloudCover", Random.Range(0.28f, 0.50f));
        gMat.SetFloat("_Bands",      Random.Range(0.4f, 2.5f));   // 0.4=few wide bands, 2.5=many thin bands
        gMat.SetFloat("_Stretch",    Random.Range(1.2f, 3.0f));   // band horizontal stretch
        gMat.SetFloat("_TimeSpeed",  Random.Range(0.04f, 0.28f)); // band drift speed

        rMat.SetColorArray("_Colors",     light);
        rMat.SetColorArray("_DarkColors", dark);
        rMat.SetFloat("_Pixels", Mathf.Clamp(Mathf.RoundToInt(pixelSize * _scale * 3f), 150, 500));

        _mats[0]=gMat; _mats[1]=rMat;
        _timeRates[0]=TR(0.004f); _timeRates[1]=314.15f*0.004f;
        _rotOffsets[1] = 0.7f;  // ring has extra rotation offset

        MakeLayer("GasLayers", gMat, 3000);
        MakeLayer("Ring",      rMat, 3001, 3f);
    }

    // ── IceWorld ─────────────────────────────────────────────────
    // Uses: PlanetUnder (Land, Lakes) + PlanetClouds (Clouds)
    void SpawnIceWorld(float s)
    {
        _rotRate = 0.025f;
        InitArrays(3);

        Color[] t = PickTheme(ThemesIce, PlanetType.IceWorld);

        float terrainSize = Random.Range(28f, 78f);
        float cloudSize   = Random.Range(22f, 70f);
        var landMat  = MakeMat("PlanetUnder",  s, terrainSize);
        var lakeMat  = MakeMat("PlanetUnder",  s, terrainSize);
        var cloudMat = MakeMat("PlanetClouds", s, cloudSize);

        landMat .SetColorArray("_Colors", Slice(t, 0, 3));
        lakeMat .SetColorArray("_Colors", Slice(t, 3, 3));
        cloudMat.SetColorArray("_Colors", Slice(t, 6, 4));
        SetRandomCloudStyle(cloudMat);

        _mats[0]=landMat; _mats[1]=lakeMat; _mats[2]=cloudMat;
        _timeRates[0]=TR(0.02f); _timeRates[1]=TR(0.02f); _timeRates[2]=TR(0.01f);

        MakeLayer("Land",  landMat,  3000);
        MakeLayer("Lakes", lakeMat,  3001);
        MakeLayer("Cloud", cloudMat, 3002);

        // Legendary ice worlds nearly always get a polar aurora
        if (_legendary && Random.value < 0.9f)
            AddEffectLayer("Aurora", s, terrainSize, 3004, TR(0.01f));
    }

    // ── LavaWorld ────────────────────────────────────────────────
    // Uses: NoAtmosphere (Land) + PlanetCraters + LavaRivers
    void SpawnLavaWorld(float s)
    {
        _rotRate = 0.05f;
        InitArrays(3);

        Color[] t = PickTheme(ThemesLava, PlanetType.LavaWorld);

        float terrainSize = Random.Range(28f, 78f);
        float craterSize  = Random.Range(2f, 20f);   // _Size = crater COUNT (matches UI 2..20)
        var landMat  = MakeMat("NoAtmosphere",  s, terrainSize);
        var cratMat  = MakeMat("PlanetCraters", s, craterSize);
        var lavaMat  = MakeMat("LavaRivers",    s, terrainSize);

        landMat.SetColorArray("_Colors", Slice(t, 0, 3));
        cratMat.SetColorArray("_Colors", Slice(t, 3, 2));
        // Crater Speed: only 10% chance above 0.20
        cratMat.SetFloat("_TimeSpeed", (Random.value < 0.10f)
            ? Random.Range(0.20f, 0.60f) : Random.Range(0.00f, 0.20f));
        lavaMat.SetColorArray("_Colors", Slice(t, 5, 3));
        // _RiverCutoff in 0.42..0.66: never the whole planet, never zero lava.
        // 10% chance of heavier lava (lower cutoff), 90% lighter.
        float riverCutoff = (Random.value < 0.10f)
            ? Random.Range(0.42f, 0.54f)   // 10%: more lava
            : Random.Range(0.54f, 0.66f);  // 90%: lighter lava
        lavaMat.SetFloat("_RiverCutoff", riverCutoff);
        lavaMat.SetFloat("_TimeSpeed",   Random.Range(0.15f, 0.40f));

        _mats[0]=landMat; _mats[1]=cratMat; _mats[2]=lavaMat;
        _timeRates[0]=TR(0.02f); _timeRates[1]=TR(0.02f); _timeRates[2]=TR(0.02f);

        MakeLayer("Land",      landMat, 3000);
        MakeLayer("Craters",   cratMat, 3001);
        MakeLayer("LavaRivers",lavaMat, 3002);
    }


    // ── Asteroid ─────────────────────────────────────────────────
    // Single irregular rock — no spherify, spins via rotation
    void SpawnAsteroid(float s)
    {
        _rotRate = 0.12f;
        InitArrays(1);

        Color[] t = ThemesAsteroid[Random.Range(0, ThemesAsteroid.Length)];

        var mat = MakeMat("Asteroid", s, Random.Range(30f, 72f));
        mat.SetColorArray("_Colors", t);

        _mats[0]      = mat;
        _timeRates[0] = 0f;  // no time animation — only rotation

        MakeLayer("Asteroid", mat, 3000);
    }

    // ═══════════════════════════════════════════════════════════════
    //  UI — Reroll button
    // ═══════════════════════════════════════════════════════════════
    void CreateRerollButton()
    {
        var canvasGo = new GameObject("PlanetUI");
        var canvas   = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvasGo.AddComponent<CanvasScaler>();
        canvasGo.AddComponent<GraphicRaycaster>();

        if (FindObjectOfType<UnityEngine.EventSystems.EventSystem>() == null)
        {
            var es = new GameObject("EventSystem");
            es.AddComponent<UnityEngine.EventSystems.EventSystem>();
            es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
        }

        var btnGo = new GameObject("RerollButton");
        btnGo.transform.SetParent(canvasGo.transform, false);

        var rect = btnGo.AddComponent<RectTransform>();
        rect.anchorMin        = new Vector2(0.5f, 0f);
        rect.anchorMax        = new Vector2(0.5f, 0f);
        rect.pivot            = new Vector2(0.5f, 0f);
        rect.anchoredPosition = new Vector2(0f, 30f);
        rect.sizeDelta        = new Vector2(210f, 52f);

        var img   = btnGo.AddComponent<Image>();
        img.color = new Color(0.10f, 0.10f, 0.16f, 0.93f);

        var btn = btnGo.AddComponent<Button>();
        btn.targetGraphic = img;
        var bc = btn.colors;
        bc.normalColor      = new Color(0.10f, 0.10f, 0.16f, 0.93f);
        bc.highlightedColor = new Color(0.22f, 0.22f, 0.36f, 1f);
        bc.pressedColor     = new Color(0.06f, 0.06f, 0.12f, 1f);
        btn.colors = bc;
        btn.onClick.AddListener(Reroll);

        var labelGo   = new GameObject("Label");
        labelGo.transform.SetParent(btnGo.transform, false);
        var lr = labelGo.AddComponent<RectTransform>();
        lr.anchorMin = Vector2.zero; lr.anchorMax = Vector2.one;
        lr.offsetMin = lr.offsetMax = Vector2.zero;
        var txt = labelGo.AddComponent<Text>();
        txt.text      = "✦  New Planet";
        txt.font      = CustomFont;
        txt.fontSize  = 20;
        txt.fontStyle = FontStyle.Bold;
        txt.color     = new Color(0.85f, 0.85f, 1.0f);
        txt.alignment = TextAnchor.MiddleCenter;
    }

    // ── Space background ─────────────────────────────────────────────
    void CreateBackground()
    {
        var sh = Shader.Find("PixelPlanets/SpaceBackground");
        if (!sh) { Debug.LogError("Shader not found: PixelPlanets/SpaceBackground"); return; }
        _bgMat = new Material(sh);

        var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
        go.name = "SpaceBackground";
        go.transform.SetParent(transform);
        go.transform.localPosition = new Vector3(0, 0, 3f);
        Destroy(go.GetComponent<Collider>());
        go.GetComponent<MeshRenderer>().sharedMaterial = _bgMat;
        _bgMat.renderQueue = 1900;
        _bgTr = go.transform;
        FitBackgroundToViewport();
    }

    // Size the nebula quad to the visible viewport (+margin) so its full detail shows.
    void FitBackgroundToViewport()
    {
        float aspect = Camera.main != null ? Camera.main.aspect : (1080f / 1920f);
        float halfW  = OrthoSize * aspect, halfH = OrthoSize;
        if (_bgTr != null) _bgTr.localScale = new Vector3(2f*halfW*1.2f, 2f*halfH*1.2f, 1f);
        if (_bgMat != null) _bgMat.SetFloat("_Aspect", aspect);
        // Star scatter bounds track the viewport too (small margin for drift)
        _starHalfW = halfW * 1.12f;
        _starHalfH = halfH * 1.12f;
    }

    void RefreshBackground()
    {
        if (_bgMat == null) return;
        FitBackgroundToViewport();
        _bgMat.SetFloat("_Seed", Random.Range(0.2f, 5f));

        float h  = Random.value;
        Color n1 = Color.HSVToRGB(h, 0.60f, 0.35f);
        Color n2 = Color.HSVToRGB(Frac01(h + Random.Range(0.10f, 0.40f)), 0.70f, 0.28f);
        if (_starStrength > 0f) { n1 = Tinted(n1); n2 = Tinted(n2); }
        _bgMat.SetColor("_Neb1", n1);
        _bgMat.SetColor("_Neb2", n2);
        _bgMat.SetFloat("_NebAmount", Random.Range(0.6f, 1.3f));
    }

    // ── Background star sprites (PNGs in Resources/Stars) ────────────
    void CreateStarField()
    {
        _starTextures = Resources.LoadAll<Texture2D>("Stars");
        if (_starTextures == null || _starTextures.Length == 0)
        {
            Debug.Log("PixelPlanets: no star PNGs in Resources/Stars — using procedural stars only.");
            return;
        }
        _starShader = Shader.Find("PixelPlanets/StarSprite");
        if (!_starShader) { Debug.LogError("Shader not found: PixelPlanets/StarSprite"); return; }

        var root = new GameObject("StarField");
        root.transform.SetParent(transform);
        root.transform.localPosition = new Vector3(0, 0, 2.5f);   // between nebula & planet

        const int count = 70;
        for (int i = 0; i < count; i++)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            go.name = "Star" + i;
            go.transform.SetParent(root.transform);
            Destroy(go.GetComponent<Collider>());
            var mat = new Material(_starShader) { renderQueue = 1950 };
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            _bgStars.Add(new BgStar { tr = go.transform, mat = mat });
        }
        RefreshStarField();
    }

    void RefreshStarField()
    {
        if (_bgStars.Count == 0 || _starTextures == null) return;
        foreach (var st in _bgStars)
        {
            float x = Random.Range(-_starHalfW, _starHalfW);
            float y = Random.Range(-_starHalfH, _starHalfH);
            st.x0 = x; st.y = y;
            st.tr.localPosition = new Vector3(x, y, 0f);
            // Mostly tiny distant stars, some medium, a few bright big ones
            float roll = Random.value;
            st.baseScale = roll < 0.72f ? Random.Range(0.05f, 0.15f)
                         : roll < 0.93f ? Random.Range(0.15f, 0.34f)
                                        : Random.Range(0.34f, 0.60f);
            st.tr.localScale = Vector3.one * st.baseScale;
            st.mat.mainTexture = _starTextures[Random.Range(0, _starTextures.Length)];

            // Colour: mostly white, some blue/orange, occasionally biased to the star tint
            Color c = Color.white;
            float r = Random.value;
            if      (r < 0.20f) c = new Color(0.70f, 0.80f, 1.00f);
            else if (r < 0.35f) c = new Color(1.00f, 0.85f, 0.70f);
            if (_starStrength > 0f && Random.value < 0.5f) c = Color.Lerp(c, _starTint, 0.5f);
            st.baseCol = c * Random.Range(0.5f, 1.0f);

            st.phase   = Random.Range(0f, 6.2832f);
            st.twSpeed = Random.Range(0.8f, 2.2f);
            st.drift   = Random.Range(0.02f, 0.12f) * (Random.value < 0.5f ? 1f : -1f);
        }
    }

    // ── On-screen procedural name ────────────────────────────────────
    void CreateNameLabel()
    {
        var canvasGo = GameObject.Find("PlanetUI");
        if (canvasGo == null) return;

        var go = new GameObject("PlanetName");
        go.transform.SetParent(canvasGo.transform, false);
        var rect = go.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0.5f, 1f);
        rect.anchorMax = new Vector2(0.5f, 1f);
        rect.pivot     = new Vector2(0.5f, 1f);
        rect.anchoredPosition = new Vector2(0f, -26f);
        rect.sizeDelta        = new Vector2(640f, 60f);

        var txt = go.AddComponent<Text>();
        txt.font = CustomFont;
        txt.fontSize  = 34;
        txt.fontStyle = FontStyle.Bold;
        txt.alignment = TextAnchor.UpperCenter;
        txt.color     = new Color(0.92f, 0.95f, 1.0f);

        // Thin outline just for legibility over the busy background
        var outline = go.AddComponent<Outline>();
        outline.effectColor    = new Color(0, 0, 0, 0.5f);
        outline.effectDistance = new Vector2(1f, -1f);
        _nameLabel = txt;
    }

    // ── Procedural name generator ────────────────────────────────────
    static readonly string[] _nA = {"Var","Zen","Kel","Xor","Tha","Nyx","Aur","Vel","Or","Cae",
                                     "Pyr","Lor","Mor","Eri","Tal","Qua","Sol","Vor","Hel","Dra"};
    static readonly string[] _nB = {"ad","os","ix","un","eth","ar","is","or","ax","el","yn","us","an","ir","om","ent"};
    static readonly string[] _nC = {"ia","on","us","ar","eth","ix","or","a","um","ys"};
    static readonly string[] _desig = {"Prime","Major","Minor","Alpha","Beta","Gamma","Delta","Proxima","Nova","Secundus"};

    string GenName()
    {
        string n = _nA[Random.Range(0, _nA.Length)] + _nB[Random.Range(0, _nB.Length)];
        if (Random.value < 0.5f) n += _nC[Random.Range(0, _nC.Length)];

        float r = Random.value;
        if      (r < 0.30f) n += " " + _desig[Random.Range(0, _desig.Length)];
        else if (r < 0.55f) n += " " + Roman(Random.Range(1, 13));
        else if (r < 0.72f) n += "-" + Random.Range(1, 999);
        return n;
    }

    static string Roman(int v)
    {
        string[] rn = {"", "I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"};
        return (v >= 0 && v < rn.Length) ? rn[v] : v.ToString();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Utilities
    // ═══════════════════════════════════════════════════════════════
    // ── Cloud style randomizer ───────────────────────────────────────
    // Varies: density, horizontal stretch, drift speed, and curve shape.
    static void SetRandomCloudStyle(Material mat)
    {
        // Cloud Density on the UI scale: only a 10% chance to exceed 0.50 (dense).
        // UI inverts display→property: _CloudCover = 1.61 - density  (UI range 0.01..1.60).
        float density = (Random.value < 0.10f)
            ? Random.Range(0.50f, 1.60f)   // 10%: dense
            : Random.Range(0.01f, 0.50f);  // 90%: sparser
        float cover = 1.61f - density;

        // Stretch: 1.0 = round puffs, 3.0 = long horizontal streaks
        float stretch = Random.Range(1.0f, 3.0f);

        // TimeSpeed: how fast clouds scroll across the planet
        float speed = Random.Range(0.06f, 0.35f);

        // CloudCurve: how much clouds bunch toward the equator
        float curve = Random.Range(1.0f, 1.9f);

        mat.SetFloat("_CloudCover",  cover);
        mat.SetFloat("_Stretch",     stretch);
        mat.SetFloat("_TimeSpeed",   speed);
        mat.SetFloat("_CloudCurve",  curve);
    }

    Color[] Slice(Color[] src, int start, int count)
    {
        var out_ = new Color[count];
        for (int i = 0; i < count; i++)
        {
            // Chaotic ignores the theme; otherwise take the curated/generated colour.
            Color c = _chaosColors
                ? new Color(Random.value, Random.value, Random.value)
                : src[start + i];
            out_[i] = Tinted(c);   // apply star-light tint
        }
        return out_;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Variety helpers — star light, smart palettes, rings, moons
    // ═══════════════════════════════════════════════════════════════

    // ── Star light tint ──────────────────────────────────────────────
    void PickStarTint(int rarity)
    {
        float roll = Random.value;
        if      (roll < 0.30f) _starTint = new Color(1.00f, 0.55f, 0.40f); // red / orange dwarf
        else if (roll < 0.55f) _starTint = new Color(1.00f, 0.85f, 0.55f); // warm yellow
        else if (roll < 0.75f) _starTint = new Color(0.60f, 0.75f, 1.00f); // blue
        else if (roll < 0.90f) _starTint = new Color(0.85f, 0.60f, 1.00f); // violet
        else                   _starTint = new Color(0.50f, 1.00f, 0.80f); // exotic teal
        _starStrength = rarity == 2 ? Random.Range(0.35f, 0.55f)
                                    : Random.Range(0.15f, 0.35f);
    }

    Color Tinted(Color c)
    {
        if (_starStrength <= 0f) return c;
        var t = Color.Lerp(Color.white, _starTint, _starStrength);
        return new Color(c.r * t.r, c.g * t.g, c.b * t.b, c.a);
    }

    Color[] Tint(Color[] a)
    {
        var o = new Color[a.Length];
        for (int i = 0; i < a.Length; i++) o[i] = Tinted(a[i]);
        return o;
    }

    // ── Smart HSV palettes ───────────────────────────────────────────
    Color[] PickTheme(Color[][] curated, PlanetType type)
        => _proceduralColors ? GenTheme(type) : curated[Random.Range(0, curated.Length)];

    static float Frac01(float x) => x - Mathf.Floor(x);

    // Dark→light ramp around a hue. More saturated when dark, brighter when light.
    static Color[] MakeRamp(float h, float sLo, float sHi, float vLo, float vHi, int n)
    {
        var a = new Color[n];
        for (int i = 0; i < n; i++)
        {
            float u = n <= 1 ? 0f : (float)i / (n - 1);
            float s = Mathf.Clamp01(Mathf.Lerp(sHi, sLo, u));
            float v = Mathf.Clamp01(Mathf.Lerp(vLo, vHi, u));
            a[i] = Color.HSVToRGB(Frac01(h), s, v);
        }
        return a;
    }

    static Color[] Cat(params Color[][] parts)
    {
        var list = new List<Color>();
        foreach (var p in parts) list.AddRange(p);
        return list.ToArray();
    }

    // Builds a full-length, harmonious palette matching each type's slot layout.
    Color[] GenTheme(PlanetType type)
    {
        float h = Random.value;
        switch (type)
        {
            case PlanetType.TerranWet:
                return Cat(
                    MakeRamp(h, 0.55f, 0.85f, 0.16f, 0.50f, 3),                                   // water
                    MakeRamp(Frac01(h + Random.Range(0.25f, 0.50f)), 0.45f, 0.80f, 0.15f, 0.60f, 4), // land
                    MakeRamp(h, 0.00f, 0.12f, 0.55f, 0.98f, 4));                                  // cloud
            case PlanetType.IceWorld:
                return Cat(
                    MakeRamp(h, 0.10f, 0.40f, 0.50f, 0.95f, 3),               // icy land
                    MakeRamp(Frac01(h + 0.05f), 0.45f, 0.80f, 0.18f, 0.60f, 3), // lakes
                    MakeRamp(h, 0.00f, 0.10f, 0.70f, 1.00f, 4));              // cloud
            case PlanetType.NoAtmosphere:
                return Cat(
                    MakeRamp(h, 0.08f, 0.40f, 0.12f, 0.72f, 3),  // ground
                    MakeRamp(h, 0.08f, 0.40f, 0.06f, 0.40f, 2)); // crater
            case PlanetType.GasGiant:
                return Cat(
                    MakeRamp(h, 0.35f, 0.70f, 0.40f, 0.92f, 3),                                   // light bands
                    MakeRamp(Frac01(h + Random.Range(-0.06f, 0.06f)), 0.50f, 0.85f, 0.08f, 0.40f, 3)); // dark bands
            case PlanetType.LavaWorld:
                float lh = Random.value < 0.6f ? Random.Range(0.00f, 0.10f) : Frac01(h + 0.5f);
                return Cat(
                    MakeRamp(h, 0.20f, 0.50f, 0.05f, 0.24f, 3),   // rock
                    MakeRamp(h, 0.20f, 0.50f, 0.04f, 0.18f, 2),   // crater
                    MakeRamp(lh, 0.80f, 1.00f, 0.50f, 1.00f, 3)); // glowing lava
        }
        return new[] { Color.gray, Color.gray, Color.gray };
    }

    // ── Append an extra animated layer to the live material arrays ────
    void AppendMat(Material m, float timeRate, float rotOffset)
    {
        int n = _mats.Length;
        System.Array.Resize(ref _mats,       n + 1);
        System.Array.Resize(ref _timeRates,  n + 1);
        System.Array.Resize(ref _rotOffsets, n + 1);
        _mats[n] = m; _timeRates[n] = timeRate; _rotOffsets[n] = rotOffset;
    }

    // ── Legendary effect layer (additive overlay sharing planet rotation) ──
    Material AddEffectLayer(string shader, float cSeed, float size, int queue, float timeRate)
    {
        var m = MakeMat(shader, cSeed, size);
        if (m == null) return null;
        AppendMat(m, timeRate, 0f);
        MakeLayer(shader, m, queue);
        return m;
    }

    // ── Ring (for non-gas planets) ───────────────────────────────────
    void AddRing(float cSeed)
    {
        var rMat = MakeMat("PlanetRing", cSeed);
        if (rMat == null) return;
        float h = Random.value;
        rMat.SetColorArray("_Colors",     Tint(MakeRamp(h, 0.30f, 0.60f, 0.45f, 0.90f, 3)));
        rMat.SetColorArray("_DarkColors", Tint(MakeRamp(h, 0.40f, 0.70f, 0.10f, 0.40f, 3)));
        rMat.SetFloat("_Pixels", Mathf.Clamp(Mathf.RoundToInt(pixelSize * _scale * 3f), 150, 500));
        AppendMat(rMat, TR(0.004f), Random.Range(0.30f, 0.90f));
        MakeLayer("Ring", rMat, 3050, 3f);
    }

    // ── Orbiting moon ────────────────────────────────────────────────
    // A small container with a shaded surface + (usually) a crater layer,
    // both spinning together. Several rock "flavours" for variety.
    void AddMoon(float cSeed, int idx)
    {
        var root = new GameObject("Moon" + idx);
        root.transform.SetParent(_root.transform);
        root.transform.localPosition = Vector3.zero;

        float rot   = Random.Range(0f, 6.2832f);
        int   moonPx = Mathf.Clamp(Mathf.RoundToInt(pixelSize * _scale * 0.5f), 40, 110);

        // Rock flavour: gray / tan / icy / rust — drives the hue & saturation
        float h, sLo, sHi, vLo, vHi;
        float roll = Random.value;
        if      (roll < 0.40f) { h = Random.value;            sLo = 0.02f; sHi = 0.12f; vLo = 0.32f; vHi = 0.84f; } // gray
        else if (roll < 0.65f) { h = Random.Range(0.07f,0.12f); sLo = 0.22f; sHi = 0.48f; vLo = 0.30f; vHi = 0.80f; } // tan
        else if (roll < 0.85f) { h = Random.Range(0.55f,0.62f); sLo = 0.12f; sHi = 0.38f; vLo = 0.48f; vHi = 0.94f; } // icy
        else                   { h = Random.Range(0.01f,0.06f); sLo = 0.35f; sHi = 0.62f; vLo = 0.26f; vHi = 0.72f; } // rust

        var mats = new List<Material>();

        var surf = MakeMoonQuad(root.transform, "NoAtmosphere", cSeed + idx * 0.31f, Random.Range(30f, 70f), moonPx, rot);
        if (surf == null) { Destroy(root); return; }
        surf.SetColorArray("_Colors", Tint(MakeRamp(h, sLo, sHi, vLo, vHi, 3)));
        surf.SetFloat("_TimeSpeed", 0f);
        AppendMat(surf, 0f, rot);
        mats.Add(surf);

        // Craters give the real "moon" read — most moons get them
        if (Random.value < 0.80f)
        {
            var cr = MakeMoonQuad(root.transform, "PlanetCraters", cSeed + idx * 0.31f + 5f, Random.Range(2f, 6f), moonPx, rot);
            if (cr != null)
            {
                cr.SetColorArray("_Colors", Tint(MakeRamp(h, sLo + 0.05f, sHi + 0.10f, vLo * 0.45f, vHi * 0.55f, 2)));
                cr.SetFloat("_TimeSpeed",    0f);
                cr.SetFloat("_CraterRadius", Random.Range(0.9f, 1.6f));
                cr.SetFloat("_CraterCutoff", Random.Range(0.45f, 0.70f));
                AppendMat(cr, 0f, rot);
                mats.Add(cr);
            }
        }

        float baseScale = 1.8f * _scale * Random.Range(0.13f, 0.26f);
        float moonR     = baseScale * 0.5f;                       // moon disc radius
        // Both semi-axes must exceed (planetRadius + moonRadius + gap) so the
        // moon NEVER enters the planet disc, anywhere on its orbit.
        float clear      = _scale * 0.9f + moonR + _scale * 0.16f;
        float longExtra  = Random.Range(0.20f, 0.70f) * _scale;
        float shortExtra = Random.Range(0.00f, 0.20f) * _scale;
        float ax, ay;
        if (_portrait) { ax = clear + shortExtra; ay = clear + longExtra;  } // tall ellipse
        else           { ax = clear + longExtra;  ay = clear + shortExtra; } // wide ellipse

        _moons.Add(new Moon {
            tr        = root.transform,
            mats      = mats.ToArray(),
            ax        = ax,
            ay        = ay,
            speed     = Random.Range(0.30f, 0.80f) * (Random.value < 0.5f ? 1f : -1f),
            phase     = Random.Range(0f, 6.2832f),
            baseScale = baseScale,
        });
    }

    // One quad layer of a moon: a unit quad parented to the moon container.
    Material MakeMoonQuad(Transform parent, string shader, float cSeed, float size, int px, float rot)
    {
        var mat = MakeMat(shader, cSeed, size);
        if (mat == null) return null;
        var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
        go.name = shader;
        go.transform.SetParent(parent);
        go.transform.localPosition = Vector3.zero;
        go.transform.localScale    = Vector3.one;   // container holds the world scale
        Destroy(go.GetComponent<Collider>());
        mat.SetFloat("_Pixels",   px);
        mat.SetFloat("_Rotation", rot);
        go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        return mat;
    }
}
