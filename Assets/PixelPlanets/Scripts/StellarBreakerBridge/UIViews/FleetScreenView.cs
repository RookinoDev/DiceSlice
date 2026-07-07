using System.Collections.Generic;
using TMPro;
using UnityEngine;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>Fleet Roster full screen (mockup 2A). Spawns one FleetRowView per ship into a
    /// ScrollRect content and refreshes them while visible.</summary>
    public class FleetScreenView : MonoBehaviour
    {
        [SerializeField] TMP_Text goldLabel;
        [SerializeField] TMP_Text incomeLabel;
        [SerializeField] TMP_Text unlockedCountLabel;   // "6 / 19 UNLOCKED"
        [SerializeField] FleetRowView rowPrefab;
        [SerializeField] Transform content;              // ScrollRect Content transform

        GameSession _s;
        readonly List<FleetRowView> _rows = new List<FleetRowView>();

        public void Bind(GameSession session)
        {
            _s = session;
            foreach (var r in _rows) Destroy(r.gameObject);
            _rows.Clear();

            for (int i = 0; i < session.Ships.Count; i++)
            {
                var row = Instantiate(rowPrefab, content);
                row.Bind(session, i);
                _rows.Add(row);
            }
        }

        public void Refresh()
        {
            if (_s == null) return;
            if (goldLabel)   goldLabel.text   = _s.Wallet.Stardust.ToShortString();
            if (incomeLabel) incomeLabel.text = _s.Ships.FleetDps().ToShortString() + "/s";

            int unlocked = 0;
            for (int i = 0; i < _s.Ships.Count; i++) if (_s.Ships.IsOwned(i)) unlocked++;
            if (unlockedCountLabel) unlockedCountLabel.text = unlocked + " / " + _s.Ships.Count + " UNLOCKED";

            for (int i = 0; i < _rows.Count; i++) _rows[i].Refresh();
        }
    }
}
