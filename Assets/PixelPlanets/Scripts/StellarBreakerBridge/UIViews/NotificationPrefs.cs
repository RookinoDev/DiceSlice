using UnityEngine;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// Persisted on/off flag for the Settings "Notifications" toggle. No OS-level push/local
    /// notification scheduling exists in this project yet — this only stores the player's
    /// preference so that a future notification-scheduling system has something to read.
    /// </summary>
    public static class NotificationPrefs
    {
        const string Key = "StellarBreaker.NotificationsEnabled";

        public static bool Enabled
        {
            get => PlayerPrefs.GetInt(Key, 1) != 0;
            set => PlayerPrefs.SetInt(Key, value ? 1 : 0);
        }
    }
}
