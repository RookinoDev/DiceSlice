using UnityEngine;

/// <summary>
/// Per-object Toon overrides. Add this component to any GameObject to
/// customize its toon appearance without touching the global ToonManager.
/// Changes take effect the next time ToonManager scans (within rescanInterval).
/// </summary>
public class ToonObject : MonoBehaviour
{
    [Header("Surface")]
    public Color albedo      = Color.white;

    [Header("Shading")]
    public Color shadowColor = new Color(0.22f, 0.22f, 0.32f);
    public Color rimColor    = new Color(0.55f, 0.75f, 1.0f);

    [Header("Outline")]
    [Range(0f, 0.06f)] public float outlineWidth = 0.018f;
    public Color outlineColor = new Color(0.06f, 0.06f, 0.10f);

    // Hot-reload in editor: re-register when values change
    void OnValidate()
    {
        var mgr = FindObjectOfType<ToonManager>();
        if (mgr == null) return;
        var r = GetComponent<Renderer>();
        if (r != null) mgr.Register(r);
    }
}
