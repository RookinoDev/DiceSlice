using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>Daily Reward bottom sheet (mockup 3B): 7-day grid + one claim button.</summary>
    public class DailyRewardSheet : SheetBase
    {
        [Serializable]
        public struct DayCell
        {
            public GameObject root;
            public TMP_Text   dayLabel;       // "DAY 1"
            public TMP_Text   rewardLabel;    // "2K" / "20 Relics" for the relic day
            public GameObject checkIcon;      // shown for already-claimed days
            public GameObject lockIcon;       // shown for future days
            public GameObject todayHighlight; // border/glow shown only on the claimable day
        }

        [SerializeField] DayCell[] days;   // exactly 7, index 0 = Day 1
        [SerializeField] Button    claimButton;
        [SerializeField] TMP_Text  claimButtonLabel;

        GameSession _s;
        public event Action<GameSession.DailyPreview> OnClaimed;

        protected override void Awake()
        {
            base.Awake();
            if (claimButton) claimButton.onClick.AddListener(Claim);
        }

        public void Bind(GameSession session) => _s = session;

        void Claim()
        {
            if (_s == null) return;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var result = _s.ClaimDaily(now);
            if (result.canClaim) OnClaimed?.Invoke(result);
            Refresh();
        }

        public void Refresh()
        {
            if (_s == null || !IsOpen) return;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var preview = _s.PreviewDaily(now);   // .day = today's day-in-cycle (1..7); .canClaim = not yet claimed today
            int todayIndex = preview.day - 1;

            for (int i = 0; i < days.Length; i++)
            {
                int dayNum = i + 1;
                bool isPast   = i < todayIndex || (i == todayIndex && !preview.canClaim);
                bool isToday  = i == todayIndex && preview.canClaim;
                bool isFuture = i > todayIndex;

                if (days[i].dayLabel) days[i].dayLabel.text = "DAY " + dayNum;
                if (days[i].rewardLabel)
                {
                    bool relicDay = _s.DailyGrantsRelicOnDay(dayNum);
                    BigNumber gold = _s.DailyGoldForDay(dayNum);
                    days[i].rewardLabel.text = relicDay ? gold.ToShortString() + " +Relic" : gold.ToShortString();
                }
                if (days[i].checkIcon)      days[i].checkIcon.SetActive(isPast);
                if (days[i].lockIcon)       days[i].lockIcon.SetActive(isFuture);
                if (days[i].todayHighlight) days[i].todayHighlight.SetActive(isToday);
            }

            if (claimButton)      claimButton.interactable = preview.canClaim;
            if (claimButtonLabel) claimButtonLabel.text = preview.canClaim ? "CLAIM DAY " + preview.day + " REWARD" : "COME BACK TOMORROW";
        }
    }
}
