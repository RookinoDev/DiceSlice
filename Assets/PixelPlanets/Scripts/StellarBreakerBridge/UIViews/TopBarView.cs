using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// Persistent top bar (screens 1A/2A/2C/2D etc.): settings gear, sector pill,
    /// notification bell (Missions), daily-reward calendar icon, gold pill, income/s pill,
    /// relics pill. Pure binder — build the hierarchy/art in the Editor, assign these fields.
    /// </summary>
    public class TopBarView : MonoBehaviour
    {
        [Header("Buttons")]
        [SerializeField] Button settingsButton;
        [SerializeField] Button notificationButton;
        [SerializeField] GameObject notificationDot;   // green dot, active while a mission is claimable
        [SerializeField] Button dailyButton;
        [SerializeField] GameObject dailyDot;          // orange dot, active while daily reward is claimable

        [Header("Labels")]
        [SerializeField] TMP_Text sectorLabel;
        [SerializeField] TMP_Text goldLabel;
        [SerializeField] TMP_Text incomeLabel;
        [SerializeField] GameObject relicsPillRoot;    // whole relics pill, hidden until relics exist
        [SerializeField] TMP_Text relicsLabel;

        public event Action OnSettingsClicked;
        public event Action OnNotificationClicked;
        public event Action OnDailyClicked;

        void Awake()
        {
            if (settingsButton)     settingsButton.onClick.AddListener(() => OnSettingsClicked?.Invoke());
            if (notificationButton) notificationButton.onClick.AddListener(() => OnNotificationClicked?.Invoke());
            if (dailyButton)        dailyButton.onClick.AddListener(() => OnDailyClicked?.Invoke());
        }

        public void Refresh(GameSession s)
        {
            if (s == null) return;

            if (sectorLabel) sectorLabel.text = s.Stage.CurrentStage.ToString();
            if (goldLabel)   goldLabel.text   = s.Wallet.Stardust.ToShortString();
            if (incomeLabel) incomeLabel.text = s.Ships.FleetDps().ToShortString() + "/s";

            bool hasRelics = s.Prestige.Relics.Stardust > BigNumber.Zero || s.CanPrestige();
            if (relicsPillRoot) relicsPillRoot.SetActive(hasRelics);
            if (relicsLabel)    relicsLabel.text = s.Prestige.Relics.Stardust.ToShortString();

            if (notificationDot)
            {
                bool anyMissionClaimable = false;
                for (int i = 0; i < s.Missions.Count; i++)
                    if (s.Missions.IsComplete(i) && !s.Missions.IsClaimed(i)) { anyMissionClaimable = true; break; }
                notificationDot.SetActive(anyMissionClaimable);
            }

            if (dailyDot)
                dailyDot.SetActive(s.Daily.CanClaim(DateTimeOffset.UtcNow.ToUnixTimeSeconds()));
        }
    }
}
