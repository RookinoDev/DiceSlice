using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>Prestige full screen (mockup 2D). Tapping "PRESTIGE NOW" opens the confirm sheet
    /// (2E) rather than prestiging immediately — GameShellView wires that hand-off.</summary>
    public class PrestigeScreenView : MonoBehaviour
    {
        [SerializeField] TMP_Text relicsReadyLabel;     // big "+340"
        [SerializeField] TMP_Text currentRelicsLabel;   // "You currently hold 1.3K Relics"
        [SerializeField] TMP_Text sectorReachedLabel;
        [SerializeField] TMP_Text goldEarnedLabel;
        [SerializeField] Button   prestigeButton;

        GameSession _s;
        public event Action OnPrestigeRequested;

        void Awake()
        {
            if (prestigeButton) prestigeButton.onClick.AddListener(() => OnPrestigeRequested?.Invoke());
        }

        public void Bind(GameSession session) => _s = session;

        public void Refresh()
        {
            if (_s == null) return;
            var gained = _s.PreviewRelics();

            if (relicsReadyLabel)   relicsReadyLabel.text   = "+" + gained.ToShortString();
            if (currentRelicsLabel) currentRelicsLabel.text = "You currently hold " + _s.Prestige.Relics.Stardust.ToShortString() + " Relics";
            if (sectorReachedLabel) sectorReachedLabel.text = _s.Stage.HighestStage.ToString();
            if (goldEarnedLabel)    goldEarnedLabel.text    = _s.Wallet.Stardust.ToShortString();
            if (prestigeButton)     prestigeButton.interactable = _s.CanPrestige();
        }
    }
}
