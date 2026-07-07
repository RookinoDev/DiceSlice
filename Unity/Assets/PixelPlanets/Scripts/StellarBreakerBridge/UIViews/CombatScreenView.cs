using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Gameplay;
using StellarBreaker.UI;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// The always-visible Combat screen (mockups 1A/1B/1C): target name, legendary/boss badges,
    /// hull-integrity bar, quick skill bar, tap-damage upgrade footer. Fleet/Artifacts/Prestige
    /// are separate full screens (see BottomNavView); Skill Loadout is a sheet opened from the
    /// "+1" (more) button.
    /// </summary>
    public class CombatScreenView : MonoBehaviour
    {
        [Serializable]
        public struct SkillSlotUI
        {
            public Button    button;
            public Image     icon;
            public TMP_Text  stateLabel;   // "READY" / seconds left, overlaid on the icon
            public GameObject readyGlow;   // optional highlight ring shown only while ready
        }

        [Header("Target header")]
        [SerializeField] TMP_Text targetSubheader;   // "SECTOR 247 TARGET"
        [SerializeField] TMP_Text targetName;        // "Kessar-9 Debris Field"
        [SerializeField] GameObject legendaryBadgeRoot;
        [SerializeField] TMP_Text legendaryBadgeLabel;
        [SerializeField] GameObject bossBadgeRoot;
        [SerializeField] TMP_Text bossTimerLabel;
        [SerializeField] Image bossTimerFill;

        [Header("Hull integrity")]
        [SerializeField] Image hpFill;
        [SerializeField] TMP_Text hpLabel;

        [Header("Quick skill bar")]
        [SerializeField] SkillSlotUI[] skillSlots;   // matches GameSession.SkillSlots order
        [SerializeField] Button moreSkillsButton;     // "+1" → opens Skill Loadout sheet

        [Header("Tap-damage upgrade footer")]
        [SerializeField] TMP_Text tapLevelLabel;
        [SerializeField] TMP_Text tapDamageLabel;
        [SerializeField] Button   tapUpgradeButton;
        [SerializeField] TMP_Text tapUpgradeCostLabel;

        [Header("Optional: planet identity source (leave empty to auto-find in scene)")]
        [SerializeField] PixelPlanetGenerator planetGenerator;

        public event Action OnMoreSkillsClicked;

        GameSession _s;
        MainPresenter _presenter;

        void Awake()
        {
            if (planetGenerator == null) planetGenerator = FindObjectOfType<PixelPlanetGenerator>();
            if (moreSkillsButton) moreSkillsButton.onClick.AddListener(() => OnMoreSkillsClicked?.Invoke());
            if (tapUpgradeButton) tapUpgradeButton.onClick.AddListener(() => _s?.UpgradeTapDamage());

            if (skillSlots != null)
                for (int i = 0; i < skillSlots.Length; i++)
                {
                    int idx = i;
                    if (skillSlots[i].button) skillSlots[i].button.onClick.AddListener(() => OnSkillSlotClicked(idx));
                }
        }

        public void Bind(GameSession session)
        {
            _s = session;
            _presenter = new MainPresenter(session);
        }

        public void Refresh()
        {
            if (_s == null || _presenter == null) return;
            var vm = _presenter.Build();

            if (targetSubheader) targetSubheader.text = "SECTOR " + _s.Stage.CurrentStage + " TARGET";
            if (targetName)      targetName.text = planetGenerator != null ? planetGenerator.CurrentName : vm.stageLabel;

            bool legendary = planetGenerator != null && planetGenerator.CurrentRarity == "Legendary";
            if (legendaryBadgeRoot) legendaryBadgeRoot.SetActive(legendary && !vm.bossActive);
            if (legendary && legendaryBadgeLabel) legendaryBadgeLabel.text = "LEGENDARY · ×8 REWARDS";

            if (bossBadgeRoot) bossBadgeRoot.SetActive(vm.bossActive);
            if (vm.bossActive)
            {
                if (bossTimerLabel) bossTimerLabel.text = "0:" + vm.bossSecondsLeft.ToString("00");
                if (bossTimerFill)  bossTimerFill.fillAmount = _s.Stage.BossTimeLeft > 0
                    ? (float)(_s.Stage.BossTimeLeft / System.Math.Max(0.01, _s.BossTimerSeconds)) : 0f;
            }

            if (hpLabel) hpLabel.text = vm.hpText;
            if (hpFill)  hpFill.fillAmount = vm.hpFraction;

            RefreshSkills(vm);

            if (tapLevelLabel)  tapLevelLabel.text  = "TAP DAMAGE · LV." + vm.tapLevel;
            if (tapDamageLabel) tapDamageLabel.text = vm.tapDamageText + " per tap";
            if (tapUpgradeCostLabel) tapUpgradeCostLabel.text = vm.tapUpgradeCostText;
            if (tapUpgradeButton) tapUpgradeButton.interactable = vm.canUpgradeTap;
        }

        void RefreshSkills(MainViewModel vm)
        {
            if (skillSlots == null || vm.skills == null) return;
            for (int i = 0; i < skillSlots.Length && i < vm.skills.Length; i++)
            {
                var sv = skillSlots[i];
                var data = vm.skills[i];
                if (sv.button) sv.button.gameObject.SetActive(data.unlocked);
                if (!data.unlocked) continue;

                if (sv.stateLabel) sv.stateLabel.text = data.active ? data.secondsLeft + "s"
                                                       : data.ready ? "" : data.secondsLeft.ToString();
                if (sv.readyGlow) sv.readyGlow.SetActive(data.ready || data.active);
                if (sv.button) sv.button.interactable = data.ready;
            }
        }

        public void OnSkillSlotClicked(int index)
        {
            if (_s == null || index < 0 || index >= _s.SkillSlots.Count) return;
            _s.ActivateSkill(_s.SkillSlots[index]);
        }
    }
}
