using UnityEngine;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// Hex colors read off the "Stellar Breaker UX Design" mockups. Use these on Image/TMP
    /// components instead of hand-picking colors in the Inspector, so every screen stays
    /// visually consistent with the reference art.
    /// </summary>
    public static class UiPalette
    {
        public static readonly Color Background   = Hex("#0A0E1A");
        public static readonly Color PanelDark     = Hex("#0F1420");
        public static readonly Color PanelRaised   = Hex("#151B2C");

        public static readonly Color TextPrimary   = Hex("#F2F4FA");
        public static readonly Color TextSecondary = Hex("#8891A8");

        public static readonly Color Gold          = Hex("#FFC65C");
        public static readonly Color Cyan          = Hex("#35D6EE");
        public static readonly Color Relic         = Hex("#C08CFF");
        public static readonly Color Success       = Hex("#38E27A");
        public static readonly Color Danger        = Hex("#FF4D5E");
        public static readonly Color Boss          = Hex("#FF5C5C");

        // Prestige CTA gradient endpoints (left→right on the pill button).
        public static readonly Color PrestigeGradA = Hex("#FF9A3D");
        public static readonly Color PrestigeGradB = Hex("#FF3DBE");

        static Color Hex(string hex) => ColorUtility.TryParseHtmlString(hex, out var c) ? c : Color.magenta;
    }
}
