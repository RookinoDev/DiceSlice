// Ported from GamePhone.dc.html's Settings modal.
import { useState } from 'react'
import { prefs } from '../../game/prefs'
import { audio } from '../../game/audio/AudioManager'
import { deleteSave } from '../../game/persistence/localStorageSave'
import { syncNotificationPrefs } from '../../game/notificationApi'
import { Sheet } from '../Sheet'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  apiBaseUrl: string | undefined
  onReplayTutorial: () => void
}

const APP_VERSION = '0.1.0'

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button className={`settings-toggle ${on ? 'on' : ''}`} onClick={onToggle} aria-pressed={on}>
      <div className="settings-toggle-knob" />
    </button>
  )
}

export function SettingsSheet({ open, onClose, apiBaseUrl, onReplayTutorial }: SettingsSheetProps) {
  const [musicOn, setMusicOn] = useState(!audio.musicMuted)
  const [sfxOn, setSfxOn] = useState(!audio.muted)
  const [notificationsOn, setNotificationsOn] = useState(prefs.notificationsEnabled)
  const [resetArmed, setResetArmed] = useState(false)

  const handleClose = () => {
    setResetArmed(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={handleClose} title="SETTINGS">
      <div className="settings-row">
        <span>Music</span>
        <Toggle
          on={musicOn}
          onToggle={() => {
            setMusicOn(!musicOn)
            audio.musicMuted = musicOn
          }}
        />
      </div>
      <div className="settings-row">
        <span>Sound Effects</span>
        <Toggle
          on={sfxOn}
          onToggle={() => {
            setSfxOn(!sfxOn)
            audio.muted = sfxOn
          }}
        />
      </div>
      <div className="settings-row">
        <span>Notifications</span>
        <Toggle
          on={notificationsOn}
          onToggle={() => {
            setNotificationsOn(!notificationsOn)
            prefs.notificationsEnabled = !notificationsOn
            syncNotificationPrefs(apiBaseUrl, !notificationsOn)
          }}
        />
      </div>

      <div className="settings-row">
        <span>Tutorial</span>
        <button className="settings-replay-button" onClick={onReplayTutorial}>
          REPLAY
        </button>
      </div>

      <button className="settings-reset-button" onClick={() => setResetArmed(true)}>
        RESET SAVE
      </button>

      {resetArmed && (
        <div className="settings-confirm-box">
          <div className="settings-confirm-text">This permanently erases your progress. This cannot be undone.</div>
          <div className="settings-confirm-actions">
            <button className="settings-cancel-button" onClick={() => setResetArmed(false)}>
              CANCEL
            </button>
            <button
              className="settings-erase-button"
              onClick={() => {
                deleteSave()
                location.reload()
              }}
            >
              ERASE
            </button>
          </div>
        </div>
      )}

      <p className="settings-version">STELLAR BREAKER · v{APP_VERSION}</p>
    </Sheet>
  )
}
