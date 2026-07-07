using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>One row in the Artifacts list (mockup 2C).</summary>
    public class ArtifactRowView : MonoBehaviour
    {
        [SerializeField] Image    icon;
        [SerializeField] TMP_Text nameLabel;      // "Helios Core"
        [SerializeField] TMP_Text levelLabel;     // "LV.18"
        [SerializeField] TMP_Text bonusLabel;     // "+36% Tap Damage"
        [SerializeField] Button   upgradeButton;
        [SerializeField] TMP_Text upgradeCostLabel;

        GameSession _s;
        int _index;

        void Awake()
        {
            if (upgradeButton) upgradeButton.onClick.AddListener(() => _s?.BuyArtifact(_index));
        }

        public void Bind(GameSession session, int artifactIndex)
        {
            _s = session;
            _index = artifactIndex;
            var def = session.Artifacts.Def(artifactIndex);
            if (nameLabel) nameLabel.text = def.displayName;
        }

        public void Refresh()
        {
            if (_s == null) return;
            var arts = _s.Artifacts;
            var def = arts.Def(_index);
            int lvl = arts.LevelOf(_index);
            int pct = (int)System.Math.Round(def.BonusAt(lvl) * 100.0);

            if (levelLabel) levelLabel.text = "LV." + lvl;
            if (bonusLabel) bonusLabel.text = "+" + pct + "% " + EffectLabel(def.effect);
            if (upgradeCostLabel) upgradeCostLabel.text = arts.NextCost(_index).ToShortString();
            if (upgradeButton) upgradeButton.interactable = _s.Prestige.Relics.CanAfford(arts.NextCost(_index));
        }

        static string EffectLabel(StellarBreaker.Config.ArtifactEffect e) => e switch
        {
            StellarBreaker.Config.ArtifactEffect.Dps       => "Fleet DPS",
            StellarBreaker.Config.ArtifactEffect.Gold      => "Gold Gain",
            StellarBreaker.Config.ArtifactEffect.TapDamage => "Tap Damage",
            _ => ""
        };
    }
}
