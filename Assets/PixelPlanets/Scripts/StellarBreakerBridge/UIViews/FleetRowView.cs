using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>One row in the Fleet Roster list (mockup 2A). Spawned per-ship by FleetScreenView.</summary>
    public class FleetRowView : MonoBehaviour
    {
        [SerializeField] Image    icon;
        [SerializeField] TMP_Text nameLabel;
        [SerializeField] TMP_Text subLabel;      // "LEVEL 12 · 5.6K DPS"
        [SerializeField] Button   actionButton;
        [SerializeField] TMP_Text actionLabel;   // "UPGRADE (cost)" or "LOCKED"

        GameSession _s;
        int _index;

        void Awake()
        {
            if (actionButton) actionButton.onClick.AddListener(() => _s?.BuyShip(_index));
        }

        public void Bind(GameSession session, int shipIndex)
        {
            _s = session;
            _index = shipIndex;
            var def = session.Ships.Def(shipIndex);
            if (nameLabel) nameLabel.text = def.shipName;
            if (icon && def.icon) icon.sprite = def.icon;
        }

        public void Refresh()
        {
            if (_s == null) return;
            var ships = _s.Ships;
            bool owned = ships.IsOwned(_index);
            bool afford = _s.Wallet.CanAfford(ships.NextCost(_index));

            if (subLabel)
            {
                string cls = string.IsNullOrEmpty(ships.Def(_index).className) ? "" : ships.Def(_index).className + " · ";
                subLabel.text = owned
                    ? cls + "LEVEL " + ships.LevelOf(_index) + " · " + ships.ShipDps(_index).ToShortString() + " DPS"
                    : cls + "COST " + ships.NextCost(_index).ToShortString();
            }
            if (actionLabel) actionLabel.text = owned ? "UPGRADE" : "BUY";
            if (actionButton) actionButton.interactable = afford;
        }
    }
}
