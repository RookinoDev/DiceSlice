using UnityEngine;
using UnityEngine.UI;

namespace StellarBreaker.Hud
{
    /// <summary>Shared palette/sizing for the runtime HUD (placeholder, art-replaceable).</summary>
    public static class UiTheme
    {
        public static readonly Color Text     = new Color(0.93f, 0.95f, 1.00f);
        public static readonly Color SubText   = new Color(0.62f, 0.68f, 0.82f);
        public static readonly Color Gold      = new Color(1.00f, 0.85f, 0.40f);
        public static readonly Color Relic     = new Color(0.82f, 0.66f, 1.00f);
        public static readonly Color Boss      = new Color(1.00f, 0.78f, 0.28f);
        public static readonly Color Success   = new Color(0.55f, 1.00f, 0.65f);

        public static readonly Color Panel     = new Color(0.06f, 0.07f, 0.13f, 0.98f);
        public static readonly Color Backdrop  = new Color(0.00f, 0.00f, 0.00f, 0.66f);
        public static readonly Color BarBg     = new Color(0.00f, 0.00f, 0.00f, 0.55f);
        public static readonly Color Hp        = new Color(0.86f, 0.26f, 0.32f, 1f);

        public static readonly Color BtnNormal = new Color(0.14f, 0.17f, 0.28f, 0.97f);
        public static readonly Color BtnHi     = new Color(0.22f, 0.28f, 0.46f, 1f);
        public static readonly Color BtnDown   = new Color(0.09f, 0.10f, 0.18f, 1f);
        public static readonly Color BtnOff    = new Color(0.10f, 0.10f, 0.13f, 0.65f);
        public static readonly Color Primary   = new Color(0.18f, 0.34f, 0.62f, 0.98f);
    }

    /// <summary>Tiny uGUI builder helpers so each view stays small. Pure UI, no game types.</summary>
    public static class UiKit
    {
        public static Font Font =>
            PixelPlanetGenerator.CustomFont
            ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")
            ?? Resources.GetBuiltinResource<Font>("Arial.ttf");

        static Sprite _white;
        public static Sprite White
        {
            get
            {
                if (_white != null) return _white;
                var tex = Texture2D.whiteTexture;
                _white = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
                return _white;
            }
        }

        public static void EnsureEventSystem()
        {
            if (Object.FindObjectOfType<UnityEngine.EventSystems.EventSystem>() != null) return;
            var es = new GameObject("EventSystem");
            es.AddComponent<UnityEngine.EventSystems.EventSystem>();
            es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
        }

        public static GameObject Canvas(Transform parent, string name, int sortingOrder)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var c = go.AddComponent<UnityEngine.Canvas>();
            c.renderMode = RenderMode.ScreenSpaceOverlay;
            c.sortingOrder = sortingOrder;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            return go;
        }

        public static RectTransform Rect(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        public static Image FullStretch(Transform parent, string name, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            var img = go.AddComponent<Image>();
            img.color = color;
            return img;
        }

        public static Text Label(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size,
                                 int fontSize, TextAnchor align, Color? color = null)
        {
            var rt = Rect(parent, name, anchor, pos, size);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Font; t.fontSize = fontSize; t.fontStyle = FontStyle.Bold;
            t.alignment = align;
            t.color = color ?? UiTheme.Text;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            var sh = rt.gameObject.AddComponent<Shadow>();
            sh.effectColor = new Color(0, 0, 0, 0.6f); sh.effectDistance = new Vector2(1.5f, -1.5f);
            return t;
        }

        public static Image Panel(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color color)
        {
            var rt = Rect(parent, name, anchor, pos, size);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color; img.sprite = White;
            return img;
        }

        public static Image Bar(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color color)
        {
            var img = Panel(parent, name, anchor, pos, size, color);
            img.type = Image.Type.Filled;
            img.fillMethod = Image.FillMethod.Horizontal;
            img.fillOrigin = 0;
            return img;
        }

        public static Button Button(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size,
                                    out Text label, int fontSize = 32, Color? bg = null)
        {
            var img = Panel(parent, name, anchor, pos, size, bg ?? UiTheme.BtnNormal);
            var btn = img.gameObject.AddComponent<Button>();
            btn.targetGraphic = img;
            var c = btn.colors;
            c.normalColor      = Color.white;       // multiplies the image color
            c.highlightedColor = new Color(1.2f, 1.2f, 1.3f, 1f);
            c.pressedColor     = new Color(0.7f, 0.7f, 0.8f, 1f);
            c.disabledColor    = new Color(0.5f, 0.5f, 0.55f, 0.6f);
            c.fadeDuration     = 0.05f;
            btn.colors = c;
            label = Label(img.transform, "Label", new Vector2(0.5f, 0.5f), Vector2.zero, size, fontSize, TextAnchor.MiddleCenter);
            return btn;
        }
    }
}
