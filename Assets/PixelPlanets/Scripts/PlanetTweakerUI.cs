using System.Collections.Generic;
using UnityEngine;

public class PlanetTweakerUI : MonoBehaviour
{
    PixelPlanetGenerator _gen;
    Vector2              _scroll;

    GUIStyle _panelStyle, _headerStyle, _sectionStyle, _labelStyle, _valueStyle, _rarityStyle;
    bool     _stylesReady;

    // invert=true: higher slider → lower property value (used for Cloud Density where lower = denser)
    struct TweakDef { public string label, prop; public int matIdx; public float min, max; public bool invert; }

    static readonly Dictionary<PlanetType, TweakDef[]> Defs =
        new Dictionary<PlanetType, TweakDef[]>
    {
        { PlanetType.TerranWet, new[] {
            new TweakDef { label="Land Coverage",  prop="_LandCutoff",   matIdx=1, min=0.05f, max=0.95f },
            new TweakDef { label="Terrain Scale",  prop="_Size",          matIdx=1, min=12f,   max=92f   },
            new TweakDef { label="Ocean Scale",    prop="_Size",          matIdx=0, min=12f,   max=92f   },
            // invert: slider-right = lower _CloudCover = fully dense cover;
            // slider-left = high _CloudCover (up to 1.60) = wide open holes inside the clouds
            new TweakDef { label="Cloud Density",  prop="_CloudCover",    matIdx=2, min=0.01f, max=1.60f, invert=true },
            new TweakDef { label="Cloud Number",   prop="_Size",          matIdx=2, min=12f,   max=92f   },
            new TweakDef { label="Cloud Stretch",  prop="_Stretch",       matIdx=2, min=1.00f, max=3.50f },
            new TweakDef { label="Cloud Speed",    prop="_TimeSpeed",     matIdx=2, min=0.02f, max=0.50f },
        }},
        { PlanetType.NoAtmosphere, new[] {
            new TweakDef { label="Surface Scale",  prop="_Size",          matIdx=0, min=12f,   max=92f   },
            // _Size = grid frequency = how MANY craters (capped 2..20)
            new TweakDef { label="Crater Number",  prop="_Size",          matIdx=1, min=2f,    max=20f   },
            // _CraterRadius = each hole's SIZE only (independent of count)
            new TweakDef { label="Crater Scale",   prop="_CraterRadius",  matIdx=1, min=0.40f, max=2.50f },
            new TweakDef { label="Crater Speed",   prop="_TimeSpeed",     matIdx=1, min=0.00f, max=0.60f },
        }},
        { PlanetType.GasGiant, new[] {
            new TweakDef { label="Band Count",     prop="_Bands",         matIdx=0, min=0.30f, max=3.00f },
            new TweakDef { label="Band Stretch",   prop="_Stretch",       matIdx=0, min=1.00f, max=3.00f },
            new TweakDef { label="Band Density",   prop="_CloudCover",    matIdx=0, min=0.20f, max=0.80f },
            new TweakDef { label="Drift Speed",    prop="_TimeSpeed",     matIdx=0, min=0.01f, max=0.40f },
        }},
        { PlanetType.IceWorld, new[] {
            new TweakDef { label="Ice Scale",      prop="_Size",          matIdx=0, min=12f,   max=92f   },
            new TweakDef { label="Lake Scale",     prop="_Size",          matIdx=1, min=12f,   max=92f   },
            // invert: slider-right = lower _CloudCover = fully dense cover;
            // slider-left = high _CloudCover (up to 1.60) = wide open holes inside the clouds
            new TweakDef { label="Cloud Density",  prop="_CloudCover",    matIdx=2, min=0.01f, max=1.60f, invert=true },
            new TweakDef { label="Cloud Number",   prop="_Size",          matIdx=2, min=12f,   max=92f   },
            new TweakDef { label="Cloud Stretch",  prop="_Stretch",       matIdx=2, min=1.00f, max=3.50f },
            new TweakDef { label="Cloud Speed",    prop="_TimeSpeed",     matIdx=2, min=0.02f, max=0.50f },
        }},
        { PlanetType.LavaWorld, new[] {
            new TweakDef { label="Terrain Scale",  prop="_Size",          matIdx=0, min=12f,   max=92f   },
            // _Size = grid frequency = how MANY craters (capped 2..20)
            new TweakDef { label="Crater Number",  prop="_Size",          matIdx=1, min=2f,    max=20f   },
            // _CraterRadius = each hole's SIZE only (independent of count)
            new TweakDef { label="Crater Scale",   prop="_CraterRadius",  matIdx=1, min=0.40f, max=2.50f },
            new TweakDef { label="Crater Speed",   prop="_TimeSpeed",     matIdx=1, min=0.00f, max=0.60f },
            // _RiverCutoff clamped to 0.42..0.66: floor stops lava covering the whole planet,
            // cap guarantees there's always at least some lava. slider-right = more lava.
            new TweakDef { label="Lava Coverage",  prop="_RiverCutoff",   matIdx=2, min=0.42f, max=0.66f, invert=true },
            new TweakDef { label="Lava Speed",     prop="_TimeSpeed",     matIdx=2, min=0.05f, max=0.60f },
        }},
    };

    void Awake() { _gen = GetComponent<PixelPlanetGenerator>(); }

    void Start()
    {
        _gen.OnSpawned += () => _scroll = Vector2.zero;
    }

    void OnDestroy()
    {
        if (_gen != null) _gen.OnSpawned -= () => _scroll = Vector2.zero;
    }

    // ── Called automatically by Unity every frame to draw IMGUI ─────
    void OnGUI()
    {
        if (!_stylesReady) BuildStyles();

        var mats = _gen?.CurrentMats;
        if (mats == null || mats.Length == 0) return;

        const float W = 228f;
        float H = Screen.height - 16f;

        GUILayout.BeginArea(new Rect(Screen.width - W - 8f, 8f, W, H));
        _scroll = GUILayout.BeginScrollView(_scroll, false, false,
            GUIStyle.none, GUI.skin.verticalScrollbar);
        GUILayout.BeginVertical(_panelStyle);

        // Planet type header
        GUILayout.Space(2f);
        GUILayout.Label(_gen.CurrentType.ToString().ToUpper(), _headerStyle);
        if (!string.IsNullOrEmpty(_gen.CurrentRarity))
        {
            var prev = GUI.color;
            GUI.color = _gen.CurrentRarityColor;
            GUILayout.Label("✦ " + _gen.CurrentRarity, _rarityStyle);
            GUI.color = prev;
        }
        GUILayout.Space(4f);

        // Light direction
        DrawSection("LIGHT DIRECTION");
        float lx = DrawSlider("Light X", _gen.lightPosition.x, 0.20f, 0.80f);
        float ly = DrawSlider("Light Y", _gen.lightPosition.y, 0.20f, 0.80f);
        if (!Mathf.Approximately(lx, _gen.lightPosition.x) ||
            !Mathf.Approximately(ly, _gen.lightPosition.y))
        {
            _gen.lightPosition.x = lx;
            _gen.lightPosition.y = ly;
            PushLight(mats);
        }

        // Shadow terminator — applied to ALL layers so it actually moves the shadow
        GUILayout.Space(4f);
        DrawSection("SHADOW");
        float s0 = GetFirstFloat(mats, "_LightBorder1", 0.40f);
        float e0 = GetFirstFloat(mats, "_LightBorder2", 0.60f);
        float ns = DrawSlider("Shadow Start", s0, 0.15f, 0.60f);
        float ne = DrawSlider("Shadow End",   e0, 0.40f, 0.85f);
        if (!Mathf.Approximately(ns, s0) || !Mathf.Approximately(ne, e0))
            PushShadow(mats, ns, ne);

        // Type-specific parameters
        if (Defs.TryGetValue(_gen.CurrentType, out var defs))
        {
            GUILayout.Space(4f);
            DrawSection("PARAMETERS");
            foreach (var d in defs)
            {
                if (d.matIdx >= mats.Length || mats[d.matIdx] == null) continue;
                float cur  = mats[d.matIdx].GetFloat(d.prop);
                // For inverted params (e.g. Cloud Density, Lava Coverage):
                // flip so slider-right = more coverage/density
                float disp     = d.invert ? (d.max + d.min - cur) : cur;
                float nextDisp = DrawSlider(d.label, disp, d.min, d.max);
                if (!Mathf.Approximately(nextDisp, disp))
                {
                    float actualNext = d.invert ? (d.max + d.min - nextDisp) : nextDisp;
                    mats[d.matIdx].SetFloat(d.prop, actualNext);
                }
            }
        }

        GUILayout.Space(8f);
        GUILayout.EndVertical();
        GUILayout.EndScrollView();
        GUILayout.EndArea();
    }

    // ── One labelled slider row; returns new displayed value ─────────
    float DrawSlider(string label, float cur, float min, float max)
    {
        GUILayout.BeginHorizontal();
        GUILayout.Label(label, _labelStyle, GUILayout.Width(88f));
        float next = GUILayout.HorizontalSlider(cur, min, max, GUILayout.ExpandWidth(true));
        GUILayout.Label(next.ToString("F2"), _valueStyle, GUILayout.Width(34f));
        GUILayout.EndHorizontal();
        return next;
    }

    void DrawSection(string text)
    {
        GUILayout.Label("── " + text + " ──", _sectionStyle, GUILayout.ExpandWidth(true));
        GUILayout.Space(2f);
    }

    void PushLight(Material[] mats)
    {
        var v = new Vector4(_gen.lightPosition.x, _gen.lightPosition.y, 0, 0);
        foreach (var m in mats) if (m) m.SetVector("_LightOrigin", v);
    }

    // First material that actually has the property decides the displayed value
    static float GetFirstFloat(Material[] mats, string prop, float fallback)
    {
        foreach (var m in mats)
            if (m && m.HasProperty(prop)) return m.GetFloat(prop);
        return fallback;
    }

    // Push shadow borders to every layer that supports them (some craters use single _LightBorder)
    static void PushShadow(Material[] mats, float start, float end)
    {
        foreach (var m in mats)
        {
            if (!m) continue;
            if (m.HasProperty("_LightBorder1")) m.SetFloat("_LightBorder1", start);
            if (m.HasProperty("_LightBorder2")) m.SetFloat("_LightBorder2", end);
            if (m.HasProperty("_LightBorder"))  m.SetFloat("_LightBorder",  start);
        }
    }

    // ── Build GUIStyles once (cannot be done in Awake/constructor) ───
    void BuildStyles()
    {
        var darkTex = MakeTex(new Color(0.05f, 0.05f, 0.12f, 0.94f));
        var secTex  = MakeTex(new Color(0.10f, 0.10f, 0.20f, 1.00f));

        _panelStyle = new GUIStyle(GUI.skin.box);
        _panelStyle.normal.background = darkTex;
        _panelStyle.padding = new RectOffset(8, 8, 6, 6);
        _panelStyle.border  = new RectOffset(0, 0, 0, 0);

        _headerStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize  = 13,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleCenter,
        };
        _headerStyle.normal.textColor = new Color(0.72f, 0.84f, 1.00f);

        _rarityStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize  = 11,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleCenter,
        };
        _rarityStyle.normal.textColor = Color.white;  // tinted at draw time via GUI.color

        _sectionStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize  = 9,
            alignment = TextAnchor.MiddleCenter,
        };
        _sectionStyle.normal.textColor  = new Color(0.50f, 0.56f, 0.78f);
        _sectionStyle.normal.background = secTex;

        _labelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize  = 10,
            alignment = TextAnchor.MiddleLeft,
        };
        _labelStyle.normal.textColor = new Color(0.85f, 0.85f, 0.93f);

        _valueStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize  = 9,
            alignment = TextAnchor.MiddleRight,
        };
        _valueStyle.normal.textColor = new Color(0.60f, 0.68f, 0.88f);

        // Apply the shared project font to every IMGUI style
        var font = PixelPlanetGenerator.CustomFont;
        if (font != null)
        {
            _panelStyle.font = _headerStyle.font = _sectionStyle.font =
            _labelStyle.font = _valueStyle.font = _rarityStyle.font = font;
        }

        _stylesReady = true;
    }

    static Texture2D MakeTex(Color col)
    {
        var t = new Texture2D(1, 1);
        t.SetPixel(0, 0, col);
        t.Apply();
        return t;
    }
}
