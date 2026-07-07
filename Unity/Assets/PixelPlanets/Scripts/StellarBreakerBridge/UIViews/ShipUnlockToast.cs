using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Config;

namespace StellarBreaker.HudViews
{
    /// <summary>"New Ship Unlocked" modal (mockup 1D). Shown once whenever a ship's level goes
    /// from 0 → 1 (first purchase, not later upgrades).</summary>
    public class ShipUnlockToast : SheetBase
    {
        [SerializeField] Image    icon;
        [SerializeField] TMP_Text nameLabel;
        [SerializeField] TMP_Text classLabel;    // "DESTROYER · TIER V"
        [SerializeField] TMP_Text quoteLabel;
        [SerializeField] Button   dismissButton;
        [SerializeField] Button   viewFleetButton;

        public event Action OnViewFleetRequested;

        protected override void Awake()
        {
            base.Awake();
            if (dismissButton)   dismissButton.onClick.AddListener(Close);
            if (viewFleetButton) viewFleetButton.onClick.AddListener(() => { Close(); OnViewFleetRequested?.Invoke(); });
        }

        public void Show(ShipDefinition def, int shipIndex)
        {
            if (icon && def.icon) icon.sprite = def.icon;
            if (nameLabel)  nameLabel.text  = def.shipName;
            if (classLabel) classLabel.text = string.IsNullOrEmpty(def.className)
                ? "SHIP " + (shipIndex + 1) : def.className.ToUpperInvariant() + " · TIER " + ToRoman(shipIndex + 1);
            if (quoteLabel) quoteLabel.text = "\"The " + def.shipName + " answers your call, Commander.\"";
            Open();
        }

        static string ToRoman(int n)
        {
            // Small helper, only ever called with 1..19 (ship count) — no need for a general library.
            string[] numerals = { "I","II","III","IV","V","VI","VII","VIII","IX","X",
                                   "XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX" };
            return n >= 1 && n <= numerals.Length ? numerals[n - 1] : n.ToString();
        }
    }
}
