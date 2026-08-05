// GameAnalytics REST API v2 integration - a server-side-only forwarder that mirrors the existing
// custom D1 events (see d1.mjs's recordEvent/getAdminStats) instead of adding a client-side SDK.
// Staying server-side matters for the same reason purchase_completed's D1 event already reads its
// price from our own shop catalog instead of the client payload: the Secret Key used to sign
// every request would be trivially extractable from a web bundle if this ran in the browser, and
// a forged 'business' (revenue) event would silently pollute real monetization numbers.
//
// Deliberately skips the /init endpoint every official SDK calls at session start - its
// documented purpose is remote config, A/B testing ids, and correcting a CLIENT's possibly-wrong
// clock (docs.gameanalytics.com/.../api/setup). None of that applies here: this always runs on a
// trusted server already emitting its own correct Date.now(), so /init would only add a second
// signed round-trip for no benefit this integration needs.
//
// Session bookkeeping (session_id/session_num/last-activity) lives in PlayerDO, not here - see
// playerDurableObject.mjs's _getOrStartGASession. This module only knows how to shape and sign a
// batch of already-decided events; every call is best-effort like d1.mjs's recordEvent, so a
// GameAnalytics outage or a bad/missing key must never break gameplay or payments.

// Confirm this matches the platform configured for GA_GAME_KEY at gameanalytics.com - the game's
// dashboard settings are the source of truth for accepted values, not this constant. There's no
// real device/OS here (a Telegram Mini App has no hardware of its own to report), so these are
// constants describing that fact as accurately as GA's required schema allows, not real telemetry.
const GA_PLATFORM = 'webapp'
const GA_SDK_VERSION = 'rest api v2'
const EVENTS_URL_PREFIX = 'https://api.gameanalytics.com/v2'

async function hmacBase64(secretKey, body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/** The fields every GameAnalytics event needs regardless of category - see
 *  docs.gameanalytics.com's event-types reference. Callers spread this into each event object
 *  alongside its own category-specific fields (category, event_id, amount, ...). */
export function gaCommonFields(telegramUserId, sessionId, sessionNum) {
  return {
    v: 2,
    user_id: String(telegramUserId),
    client_ts: Math.floor(Date.now() / 1000),
    sdk_version: GA_SDK_VERSION,
    os_version: 'telegram_miniapp',
    manufacturer: 'telegram',
    device: 'webapp',
    platform: GA_PLATFORM,
    session_id: sessionId,
    session_num: sessionNum,
  }
}

/** Decides which GameAnalytics events (if any) a completed syncSave should emit - a pure function
 *  so this decision is directly testable without needing to intercept sendGAEvents (playerDurableObject.mjs
 *  owns the DO/SQL side effects: starting the session, reading/writing prestige_count_seen).
 *  grantedBoss is grantPacksFromSave's own return value (not re-derived) - it's already exactly
 *  "how many new unique boss milestones this sync crossed". Returns the new prestige_count_seen
 *  value alongside the events so the caller knows whether (and what) to persist. */
export function buildSyncGAEvents({ save, grantedBoss, isNewSession, prestigeCountSeen }) {
  const events = []
  if (isNewSession) events.push({ category: 'user' })
  if (grantedBoss > 0) events.push({ category: 'progression', event_id: `Complete:Boss:${Math.floor(save?.stats?.deepestBossCleared ?? 0)}` })
  const prestigeCount = Math.floor(Number(save?.stats?.prestigeCount)) || 0
  if (prestigeCount > prestigeCountSeen) {
    events.push({ category: 'progression', event_id: `Complete:Prestige:${prestigeCount}` })
    return { events, newPrestigeCountSeen: prestigeCount }
  }
  return { events, newPrestigeCountSeen: prestigeCountSeen }
}

/** Signs and sends one batch of fully-built GameAnalytics events. No-ops (silently - this is
 *  expected until GA_GAME_KEY/GA_SECRET_KEY are configured, see .dev.vars.example) rather than
 *  erroring, so this is safe to deploy before the GameAnalytics side of the setup is finished.
 *  Never throws into the caller - see the file header. */
export async function sendGAEvents(env, events) {
  if (!env.GA_GAME_KEY || !env.GA_SECRET_KEY || !events || events.length === 0) return
  try {
    const body = JSON.stringify(events)
    const auth = await hmacBase64(env.GA_SECRET_KEY, body)
    const res = await fetch(`${EVENTS_URL_PREFIX}/${env.GA_GAME_KEY}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body,
    })
    if (!res.ok) console.warn('[game-analytics] events rejected:', res.status, await res.text().catch(() => '(no body)'))
  } catch (e) {
    console.warn('[game-analytics] send failed:', e.message)
  }
}
