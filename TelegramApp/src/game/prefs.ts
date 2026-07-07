// Ported from Assets/PixelPlanets/Scripts/StellarBreakerBridge/UIViews/NotificationPrefs.cs,
// plus placeholders for the music/SFX mute prefs that AudioManager (M5) will read.
const NOTIFICATIONS_KEY = 'stellarbreaker.notificationsEnabled'
const MUSIC_MUTED_KEY = 'stellarbreaker.musicMuted'
const SFX_MUTED_KEY = 'stellarbreaker.sfxMuted'

function getBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? fallback : v === '1'
}

function setBool(key: string, value: boolean): void {
  localStorage.setItem(key, value ? '1' : '0')
}

export const prefs = {
  get notificationsEnabled(): boolean {
    return getBool(NOTIFICATIONS_KEY, true)
  },
  set notificationsEnabled(value: boolean) {
    setBool(NOTIFICATIONS_KEY, value)
  },
  get musicMuted(): boolean {
    return getBool(MUSIC_MUTED_KEY, false)
  },
  set musicMuted(value: boolean) {
    setBool(MUSIC_MUTED_KEY, value)
  },
  get sfxMuted(): boolean {
    return getBool(SFX_MUTED_KEY, false)
  },
  set sfxMuted(value: boolean) {
    setBool(SFX_MUTED_KEY, value)
  },
}
