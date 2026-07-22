// Push-notification opt-in/out sync (TelegramBot/server.mjs POST /api/notification-prefs).
// prefs.ts's localStorage value stays the local source of truth for the Settings toggle itself;
// this just mirrors it server-side so the bot's idle re-engagement reminder (index.mjs) can
// respect it. Fire-and-forget: on failure the server keeps whatever it already had, which
// defaults to enabled - same as the client's own default - so a dropped call is harmless.
import { getInitData } from '../telegram'

const FETCH_TIMEOUT_MS = 6000

export async function syncNotificationPrefs(apiBaseUrl: string | undefined, enabled: boolean): Promise<void> {
  const initData = getInitData()
  if (!initData || !apiBaseUrl) return
  try {
    await fetch(`${apiBaseUrl}/api/notification-prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, enabled }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (e) {
    console.warn('[notifications] prefs sync failed:', e)
  }
}
