using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// Settings bottom sheet (mockup 3D). Toggle art: use a Button whose target graphic swaps
    /// between an "on"/"off" sprite (pill + knob), OR a native Toggle if your art uses one —
    /// this binder only needs an on/off bool getter you assign a listener to, so either works.
    /// </summary>
    public class SettingsSheet : SheetBase
    {
        [SerializeField] Toggle musicToggle;
        [SerializeField] Toggle sfxToggle;
        [SerializeField] Toggle notificationsToggle;
        [SerializeField] Button resetSaveButton;
        [SerializeField] TMP_Text resetSaveLabel;
        [SerializeField] TMP_Text versionLabel;

        Action _onResetSave;
        bool _resetArmed;

        public void Bind(Action onResetSave, string version)
        {
            _onResetSave = onResetSave;
            if (versionLabel) versionLabel.text = "Stellar Breaker · v" + version;
        }

        protected override void Awake()
        {
            base.Awake();

            if (musicToggle) musicToggle.onValueChanged.AddListener(on =>
            {
                if (AudioManager.Instance != null) AudioManager.Instance.MusicMuted = !on;
            });
            if (sfxToggle) sfxToggle.onValueChanged.AddListener(on =>
            {
                if (AudioManager.Instance != null) AudioManager.Instance.Muted = !on;
            });
            if (notificationsToggle) notificationsToggle.onValueChanged.AddListener(on => NotificationPrefs.Enabled = on);

            if (resetSaveButton) resetSaveButton.onClick.AddListener(() =>
            {
                if (!_resetArmed) { _resetArmed = true; if (resetSaveLabel) resetSaveLabel.text = "TAP AGAIN TO CONFIRM"; }
                else _onResetSave?.Invoke();
            });
        }

        /// <summary>Call before Open() (e.g. from the gear button) so a stale confirm-armed
        /// state from a previous visit doesn't linger.</summary>
        public void RearmReset()
        {
            _resetArmed = false;
            if (resetSaveLabel) resetSaveLabel.text = "RESET SAVE";
        }

        public override void Open()
        {
            if (musicToggle)         musicToggle.SetIsOnWithoutNotify(AudioManager.Instance == null || !AudioManager.Instance.MusicMuted);
            if (sfxToggle)            sfxToggle.SetIsOnWithoutNotify(AudioManager.Instance == null || !AudioManager.Instance.Muted);
            if (notificationsToggle) notificationsToggle.SetIsOnWithoutNotify(NotificationPrefs.Enabled);
            base.Open();
        }
    }
}
