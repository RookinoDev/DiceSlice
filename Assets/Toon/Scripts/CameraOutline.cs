using UnityEngine;

/// <summary>
/// Post-process outline that works on EVERY rendered object — including
/// transparent procedural quads (planets) that ToonLit can't reach.
///
/// Setup: add this component to Main Camera. No other setup needed.
///
/// Edge detection:
///   • Depth + Normals edges  → solid 3D objects, backgrounds
///   • Luminance (color) edges → transparent/no-ZWrite objects (planets, particles)
///   Both combined = comprehensive coverage.
///
/// Mobile cost: 1 full-screen blit with 8 texture samples per pixel.
/// Acceptable for mid-range mobile; reduce Thickness for cheaper sampling.
/// </summary>
[ExecuteAlways]
[RequireComponent(typeof(Camera))]
[DisallowMultipleComponent]
public class CameraOutline : MonoBehaviour
{
    [Header("Outline")]
    public Color outlineColor     = new Color(0.05f, 0.05f, 0.08f, 1f);
    [Range(0.5f, 4f)]  public float thickness       = 1.2f;

    [Header("Edge Sensitivity")]
    [Range(0f, 0.5f)]  public float depthThreshold  = 0.008f;
    [Range(0f, 1f)]    public float normalThreshold  = 0.12f;
    [Range(0f, 1f)]    public float colorThreshold   = 0.18f;
    [Range(0f, 1f)]    public float colorWeight      = 0.5f;   // how much color edges contribute

    // ── Private ──────────────────────────────────────────────────────
    Material _mat;
    Camera   _cam;

    static readonly int PID_Color        = Shader.PropertyToID("_OutlineColor");
    static readonly int PID_Thickness    = Shader.PropertyToID("_Thickness");
    static readonly int PID_DepthThr     = Shader.PropertyToID("_DepthThreshold");
    static readonly int PID_NormalThr    = Shader.PropertyToID("_NormalThreshold");
    static readonly int PID_ColorThr     = Shader.PropertyToID("_ColorThreshold");
    static readonly int PID_ColorWeight  = Shader.PropertyToID("_ColorWeight");

    // ── Lifecycle ────────────────────────────────────────────────────
    void OnEnable()
    {
        _cam = GetComponent<Camera>();
        // Ask Unity to fill _CameraDepthNormalsTexture each frame
        _cam.depthTextureMode |= DepthTextureMode.DepthNormals;
        EnsureMaterial();
    }

    void OnDisable()
    {
        // Remove the flag if no other script needs it
        if (_cam != null)
            _cam.depthTextureMode &= ~DepthTextureMode.DepthNormals;
    }

    void OnValidate() => EnsureMaterial(); // hot-reload in editor

    // ── Material ─────────────────────────────────────────────────────
    void EnsureMaterial()
    {
        if (_mat != null) return;
        var sh = Shader.Find("Hidden/OutlinePostEffect");
        if (sh == null)
        {
            Debug.LogError("[CameraOutline] Shader 'Hidden/OutlinePostEffect' not found.");
            enabled = false;
            return;
        }
        _mat = new Material(sh) { hideFlags = HideFlags.HideAndDontSave };
    }

    // ── Render ───────────────────────────────────────────────────────
    void OnRenderImage(RenderTexture src, RenderTexture dst)
    {
        if (_mat == null) { Graphics.Blit(src, dst); return; }

        _mat.SetColor(PID_Color,       outlineColor);
        _mat.SetFloat(PID_Thickness,   thickness);
        _mat.SetFloat(PID_DepthThr,    depthThreshold);
        _mat.SetFloat(PID_NormalThr,   normalThreshold);
        _mat.SetFloat(PID_ColorThr,    colorThreshold);
        _mat.SetFloat(PID_ColorWeight, colorWeight);

        Graphics.Blit(src, dst, _mat);
    }
}
