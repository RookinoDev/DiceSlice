using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>Missions bottom sheet (mockup 3A). Fixed 3-quest list — one row per
    /// MissionService entry, built in the Editor (no dynamic instantiation needed since the
    /// mission catalog is a small fixed list).</summary>
    public class MissionsSheet : SheetBase
    {
        [Serializable]
        public struct Row
        {
            public TMP_Text nameLabel;         // "Destroy 40 Planets"
            public Image    progressFill;
            public TMP_Text progressLabel;      // "27/40 · 15,000 Gold"
            public Button   claimButton;
            public TMP_Text claimLabel;         // "IN PROGRESS" / "CLAIM"
        }

        [SerializeField] Row[] rows;   // must match MissionCatalog order

        GameSession _s;

        protected override void Awake()
        {
            base.Awake();
            if (rows != null)
                for (int i = 0; i < rows.Length; i++)
                {
                    int idx = i;
                    if (rows[i].claimButton) rows[i].claimButton.onClick.AddListener(() => _s?.ClaimMission(idx));
                }
        }

        public void Bind(GameSession session) => _s = session;

        public void Refresh()
        {
            if (_s == null || rows == null || !IsOpen) return;
            var m = _s.Missions;
            for (int i = 0; i < rows.Length && i < m.Count; i++)
            {
                var def = m.Def(i);
                bool complete = m.IsComplete(i);
                bool claimed  = m.IsClaimed(i);

                if (rows[i].nameLabel) rows[i].nameLabel.text = def.displayName;
                if (rows[i].progressFill) rows[i].progressFill.fillAmount = m.Progress01(i);
                if (rows[i].progressLabel)
                    rows[i].progressLabel.text = FormatProgress(m.Progress(i).ToDouble(), def.target) +
                                                  " · " + def.goldReward.ToString("N0") + " Gold";

                if (rows[i].claimLabel) rows[i].claimLabel.text = claimed ? "CLAIMED" : complete ? "CLAIM" : "IN PROGRESS";
                if (rows[i].claimButton) rows[i].claimButton.interactable = complete && !claimed;
            }
        }

        static string FormatProgress(double current, double target)
            => Math.Min(current, target).ToString("N0") + "/" + target.ToString("N0");
    }
}
