using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;

namespace StellarBreaker.HudViews
{
    /// <summary>Offline Rewards bottom sheet (mockup 3C). Shown once at launch when there's
    /// offline gold to collect.</summary>
    public class OfflineRewardsSheet : SheetBase
    {
        [SerializeField] TMP_Text bodyLabel;   // "Your fleet held the line for 3h 42m while you were away."
        [SerializeField] TMP_Text goldLabel;   // "+1.65M"
        [SerializeField] Button   collectButton;

        protected override void Awake()
        {
            base.Awake();
            if (collectButton) collectButton.onClick.AddListener(Close);
        }

        public void Show(double seconds, BigNumber gold)
        {
            int h = (int)(seconds / 3600), m = (int)((seconds % 3600) / 60);
            if (bodyLabel) bodyLabel.text = "Your fleet held the line for " + (h > 0 ? h + "h " : "") + m + "m while you were away.";
            if (goldLabel) goldLabel.text = "+" + gold.ToShortString();
            Open();
        }
    }
}
