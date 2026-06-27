using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Automatically applies ToonLit to every MeshRenderer and SkinnedMeshRenderer
/// in the scene — now and for any objects spawned later.
///
/// Skips:
///   • UI layer objects (layer 5)
///   • Objects tagged "NoToon"
///   • Objects whose current shader starts with "PixelPlanets/" or "Hidden/"
///   • Objects already processed (tracked by instance ID)
///
/// Zero setup required: auto-creates itself in every scene at runtime.
/// </summary>
[DefaultExecutionOrder(-100)]   // run before other scripts
public class ToonManager : MonoBehaviour
{
    // ── Auto-bootstrap ───────────────────────────────────────────────
    /// <summary>
    /// Creates a ToonManager in every scene automatically — no manual setup needed.
    /// If you already placed one in the scene, this finds it and skips creation.
    /// </summary>
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void AutoCreate()
    {
        if (FindObjectOfType<ToonManager>() != null) return;

        var go = new GameObject("[ToonManager]");
        go.AddComponent<ToonManager>();
        DontDestroyOnLoad(go);   // survives scene changes
    }

    [Header("Material")]
    [Tooltip("Leave null to auto-create from the bundled ToonLit shader.")]
    public Material toonMaterial;

    [Header("Defaults (used when no ToonObject component overrides)")]
    public Color defaultShadowColor = new Color(0.22f, 0.22f, 0.32f);
    public Color defaultRimColor    = new Color(0.55f, 0.75f, 1.0f);
    [Range(0,1)] public float defaultOutlineWidth = 0.018f;
    public Color defaultOutlineColor = new Color(0.06f, 0.06f, 0.10f);

    [Header("Scan")]
    [Tooltip("How often (seconds) to re-scan for newly spawned objects.")]
    public float rescanInterval = 1.5f;

    // ── Private ──────────────────────────────────────────────────────
    // Tracks which renderer instance IDs have already been processed
    readonly HashSet<int> _processed = new HashSet<int>();

    static readonly int PID_ShadowColor  = Shader.PropertyToID("_ShadowColor");
    static readonly int PID_RimColor     = Shader.PropertyToID("_RimColor");
    static readonly int PID_OutlineWidth = Shader.PropertyToID("_OutlineWidth");
    static readonly int PID_OutlineColor = Shader.PropertyToID("_OutlineColor");
    static readonly int PID_Color        = Shader.PropertyToID("_Color");

    // ── Lifecycle ────────────────────────────────────────────────────
    void Awake()
    {
        EnsureMaterial();
    }

    void Start()
    {
        ScanAll();
        StartCoroutine(RescanLoop());
    }

    // ── Material bootstrap ───────────────────────────────────────────
    void EnsureMaterial()
    {
        if (toonMaterial != null) return;

        var sh = Shader.Find("Toon/ToonLit");
        if (sh == null)
        {
            Debug.LogError("[ToonManager] Shader 'Toon/ToonLit' not found. " +
                           "Make sure ToonLit.shader is inside the project.");
            enabled = false;
            return;
        }

        toonMaterial = new Material(sh) { name = "ToonLit_Base" };
        toonMaterial.SetColor(PID_ShadowColor,  defaultShadowColor);
        toonMaterial.SetColor(PID_RimColor,     defaultRimColor);
        toonMaterial.SetFloat(PID_OutlineWidth, defaultOutlineWidth);
        toonMaterial.SetColor(PID_OutlineColor, defaultOutlineColor);
    }

    // ── Scan ─────────────────────────────────────────────────────────
    void ScanAll()
    {
        var renderers = new List<Renderer>();
        renderers.AddRange(FindObjectsOfType<MeshRenderer>());
        renderers.AddRange(FindObjectsOfType<SkinnedMeshRenderer>());

        int applied = 0;
        foreach (var r in renderers)
        {
            bool wasNew = !_processed.Contains(r.GetInstanceID());
            TryApply(r);
            if (wasNew && _processed.Contains(r.GetInstanceID())) applied++;
        }

        if (applied > 0)
            Debug.Log($"[ToonManager] Applied toon to {applied} new renderer(s). " +
                      $"Total tracked: {_processed.Count}. " +
                      $"Scene renderers found: {renderers.Count}");
    }

    IEnumerator RescanLoop()
    {
        var wait = new WaitForSeconds(rescanInterval);
        while (true)
        {
            yield return wait;
            ScanAll();
        }
    }

    // ── Per-renderer logic ───────────────────────────────────────────
    void TryApply(Renderer r)
    {
        if (r == null) return;
        if (_processed.Contains(r.GetInstanceID())) return;
        if (!ShouldApply(r)) return;

        ApplyToon(r);
        _processed.Add(r.GetInstanceID());
    }

    bool ShouldApply(Renderer r)
    {
        // UI layer
        if (r.gameObject.layer == 5) return false;

        // "NoToon" tag opt-out (use == instead of CompareTag to avoid tag-undefined error)
        if (r.gameObject.tag == "NoToon") return false;

        // PixelPlanets procedural shaders keep their own look
        var mat = r.sharedMaterial;
        if (mat == null) return false;
        var sn = mat.shader?.name ?? "";
        if (sn.StartsWith("PixelPlanets/")) return false;
        if (sn.StartsWith("Hidden/"))       return false;
        if (sn == "Toon/ToonLit")           return false; // already toon

        return true;
    }

    void ApplyToon(Renderer r)
    {
        // Read the original albedo color so each object keeps its look
        var original = r.sharedMaterial;
        Color albedo = Color.white;
        if (original != null && original.HasProperty("_Color"))
            albedo = original.GetColor("_Color");
        else if (original != null && original.HasProperty("_BaseColor"))
            albedo = original.GetColor("_BaseColor");

        // Check for per-object overrides
        var ovr = r.GetComponent<ToonObject>();

        // Assign the shared base material (no new instance = zero GC)
        r.sharedMaterial = toonMaterial;

        // Per-renderer property block — overrides without creating a new Material
        var block = new MaterialPropertyBlock();
        r.GetPropertyBlock(block);
        block.SetColor(PID_Color, ovr != null ? ovr.albedo : albedo);
        block.SetColor(PID_ShadowColor,  ovr != null ? ovr.shadowColor  : defaultShadowColor);
        block.SetColor(PID_RimColor,     ovr != null ? ovr.rimColor     : defaultRimColor);
        block.SetFloat(PID_OutlineWidth, ovr != null ? ovr.outlineWidth : defaultOutlineWidth);
        block.SetColor(PID_OutlineColor, ovr != null ? ovr.outlineColor : defaultOutlineColor);
        r.SetPropertyBlock(block);
    }

    // ── Public API ───────────────────────────────────────────────────

    /// <summary>Force-apply toon to a specific renderer (e.g. after runtime spawn).</summary>
    public void Register(Renderer r)
    {
        _processed.Remove(r.GetInstanceID()); // allow re-apply
        TryApply(r);
    }

    /// <summary>Remove toon from a renderer (restores nothing — caller must track original).</summary>
    public void Unregister(Renderer r)
    {
        if (r == null) return;
        _processed.Remove(r.GetInstanceID());
        r.SetPropertyBlock(null);
    }
}
