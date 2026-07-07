using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>Skill Loadout bottom sheet (mockup 2B). One row per skill slot, in the same
    /// order as GameSession.SkillSlots.</summary>
    public class SkillLoadoutSheet : SheetBase
    {
        [Serializable]
        public struct Row
        {
            public GameObject root;
            public Image     icon;
            public TMP_Text  nameLabel;
            public TMP_Text  descriptionLabel;
            public TMP_Text  stateLabel;    // "READY" (green) or "0:38" (countdown)
            public Button    button;
        }

        [SerializeField] Row[] rows;

        GameSession _s;

        protected override void Awake()
        {
            base.Awake();
            if (rows != null)
                for (int i = 0; i < rows.Length; i++)
                {
                    int idx = i;
                    if (rows[i].button) rows[i].button.onClick.AddListener(() => Activate(idx));
                }
        }

        public void Bind(GameSession session) => _s = session;

        void Activate(int index)
        {
            if (_s == null || index >= _s.SkillSlots.Count) return;
            _s.ActivateSkill(_s.SkillSlots[index]);
        }

        public void Refresh()
        {
            if (_s == null || rows == null || !IsOpen) return;
            var slots = _s.SkillSlots;
            for (int i = 0; i < rows.Length; i++)
            {
                bool exists = i < slots.Count;
                if (rows[i].root) rows[i].root.SetActive(exists);
                if (!exists) continue;

                var t = slots[i];
                bool unlocked = _s.Skills.IsUnlocked(t);
                if (rows[i].root) rows[i].root.SetActive(unlocked);
                if (!unlocked) continue;

                bool active = _s.Skills.IsActive(t);
                bool ready  = _s.Skills.CanActivate(t);
                double secs = active ? _s.Skills.ActiveTimeLeft(t) : _s.Skills.Cooldown(t);

                if (rows[i].nameLabel)        rows[i].nameLabel.text = _s.Skills.Name(t);
                if (rows[i].descriptionLabel) rows[i].descriptionLabel.text = _s.Skills.Description(t);
                if (rows[i].stateLabel)       rows[i].stateLabel.text = ready ? "READY" : FormatSeconds(secs);
                if (rows[i].button)           rows[i].button.interactable = ready;
            }
        }

        static string FormatSeconds(double secs)
        {
            int s = (int)Math.Ceiling(secs);
            return "0:" + s.ToString("00");
        }
    }
}
