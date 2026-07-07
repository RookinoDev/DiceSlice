using UnityEngine;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;

/// <summary>
/// Visual-only fleet placeholder. Drops a distinct colored box under each numbered child
/// (1..N) of the scene object "ShipPlaceMent" so every ship slot is visible in-game.
///
/// Pure presentation: it READS ship ownership (to optionally dim locked ships) but never
/// writes gameplay state. No economy / DPS / progression logic here. Replace the boxes with
/// real ship sprites later by swapping each ShipVisual's SpriteRenderer.sprite.
///
/// Lives in Assembly-CSharp (like the other bridge scripts) so it can resolve GameSession.
/// </summary>
public class FleetVisualPlacer : MonoBehaviour
{
    [Header("Placement")]
    [Tooltip("Root holding the numbered children \"1\"..\"19\". Auto-found by name if left empty.")]
    [SerializeField] private Transform placementRoot;
    [SerializeField] private int  shipCount = 19;

    [Header("Box look")]
    [Tooltip("World-space size of each placeholder box (camera is orthographic, size 2.5).")]
    [SerializeField] private Vector2 boxSize = new Vector2(0.45f, 0.45f);
    [SerializeField] private float   colorSaturation = 0.65f;
    [SerializeField] private float   colorValue      = 0.95f;

    [Header("Sorting (above background, below the screen-space HUD)")]
    [SerializeField] private string sortingLayer = "Default";
    [SerializeField] private int    orderInLayer = 5;

    [Header("Optional unlock feedback (read-only)")]
    [SerializeField] private bool  dimWhenLocked = true;
    [SerializeField, Range(0f, 1f)] private float lockedAlpha = 0.25f;

    static Sprite _box;
    SpriteRenderer[] _renderers;
    ShipService _ships;

    void Start()
    {
        if (placementRoot == null)
        {
            var go = GameObject.Find("ShipPlaceMent");
            if (go != null) placementRoot = go.transform;
        }
        if (placementRoot == null)
        {
            Debug.LogWarning("[FleetVisualPlacer] 'ShipPlaceMent' not found — no fleet visuals placed.");
            enabled = false;
            return;
        }

        _ships = GameContext.Get<GameSession>()?.Ships;   // null is fine (just no dimming)
        Build();
    }

    void Build()
    {
        _renderers = new SpriteRenderer[shipCount];
        for (int i = 0; i < shipCount; i++)
        {
            // Find the placement child by NAME ("1".."19") — never by sibling order.
            Transform child = placementRoot.Find((i + 1).ToString());
            if (child == null) continue;

            // A dedicated visual child keeps the placement Transform itself untouched.
            Transform vis = child.Find("ShipVisual");
            if (vis == null)
            {
                var go = new GameObject("ShipVisual");
                go.transform.SetParent(child, false);
                vis = go.transform;
            }

            var sr = vis.GetComponent<SpriteRenderer>();
            if (sr == null) sr = vis.gameObject.AddComponent<SpriteRenderer>();
            sr.sprite           = Box();
            sr.color            = ColorFor(i);
            sr.sortingLayerName = sortingLayer;
            sr.sortingOrder     = orderInLayer;

            vis.localPosition = Vector3.zero;
            vis.localRotation = Quaternion.identity;
            vis.localScale    = new Vector3(boxSize.x, boxSize.y, 1f);

            _renderers[i] = sr;
        }
    }

    void Update()
    {
        if (!dimWhenLocked || _ships == null || _renderers == null) return;
        for (int i = 0; i < _renderers.Length; i++)
        {
            var sr = _renderers[i];
            if (sr == null) continue;
            bool owned = i < _ships.Count && _ships.IsOwned(i);
            var c = sr.color;
            c.a = owned ? 1f : lockedAlpha;
            sr.color = c;
        }
    }

    // Evenly spaced hues so all 19 placeholders are visually distinct.
    Color ColorFor(int i)
        => Color.HSVToRGB((i / (float)Mathf.Max(1, shipCount)) % 1f, colorSaturation, colorValue);

    // 1×1 white sprite at PPU 1 → SpriteRenderer base size = 1 world unit, so localScale == world size.
    static Sprite Box()
    {
        if (_box != null) return _box;
        var tex = new Texture2D(1, 1, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
        tex.SetPixel(0, 0, Color.white);
        tex.Apply();
        _box = Sprite.Create(tex, new Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f), 1f);
        _box.name = "FleetBox";
        return _box;
    }
}
