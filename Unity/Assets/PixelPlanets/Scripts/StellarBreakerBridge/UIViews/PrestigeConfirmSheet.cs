using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>"Confirm Prestige" bottom sheet (mockup 2E).</summary>
    public class PrestigeConfirmSheet : SheetBase
    {
        [SerializeField] TMP_Text relicsGainedLabel;   // "+340 RELICS"
        [SerializeField] Button   cancelButton;
        [SerializeField] Button   confirmButton;

        GameSession _s;
        public event Action<BigNumber> OnPrestiged;

        protected override void Awake()
        {
            base.Awake();
            if (cancelButton)  cancelButton.onClick.AddListener(Close);
            if (confirmButton) confirmButton.onClick.AddListener(Confirm);
        }

        public void Bind(GameSession session) => _s = session;

        public override void Open()
        {
            if (relicsGainedLabel && _s != null) relicsGainedLabel.text = "+" + _s.PreviewRelics().ToShortString() + " RELICS";
            base.Open();
        }

        void Confirm()
        {
            if (_s == null) return;
            var gained = _s.DoPrestige();
            Close();
            if (gained > BigNumber.Zero) OnPrestiged?.Invoke(gained);
        }
    }
}
