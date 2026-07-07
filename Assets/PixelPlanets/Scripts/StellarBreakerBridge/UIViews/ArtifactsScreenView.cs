using System.Collections.Generic;
using UnityEngine;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>Artifacts full screen (mockup 2C): permanent Relic-bought bonuses.</summary>
    public class ArtifactsScreenView : MonoBehaviour
    {
        [SerializeField] ArtifactRowView rowPrefab;
        [SerializeField] Transform content;

        GameSession _s;
        readonly List<ArtifactRowView> _rows = new List<ArtifactRowView>();

        public void Bind(GameSession session)
        {
            _s = session;
            foreach (var r in _rows) Destroy(r.gameObject);
            _rows.Clear();

            for (int i = 0; i < session.Artifacts.Count; i++)
            {
                var row = Instantiate(rowPrefab, content);
                row.Bind(session, i);
                _rows.Add(row);
            }
        }

        public void Refresh()
        {
            for (int i = 0; i < _rows.Count; i++) _rows[i].Refresh();
        }
    }
}
