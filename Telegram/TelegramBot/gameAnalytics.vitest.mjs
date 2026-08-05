// Runs under @cloudflare/vitest-pool-workers (see vitest.config.mts) so the HMAC signing exercises
// the real Web Crypto implementation this module ships with in production, not a Node polyfill.
import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSyncGAEvents, gaCommonFields, platformFromUserAgent, sendGAEvents } from './gameAnalytics.mjs'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('platformFromUserAgent', () => {
  it('recognizes iOS (checked before mac_osx, since Safari UA on iPhone contains "like Mac OS X")', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'
    expect(platformFromUserAgent(ua)).toEqual({ platform: 'ios', osVersion: 'ios 17.4' })
  })

  it('recognizes Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
    expect(platformFromUserAgent(ua)).toEqual({ platform: 'android', osVersion: 'android 14' })
  })

  it('recognizes desktop macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
    expect(platformFromUserAgent(ua)).toEqual({ platform: 'mac_osx', osVersion: 'mac_osx 10.15' })
  })

  it('recognizes Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    expect(platformFromUserAgent(ua)).toEqual({ platform: 'windows', osVersion: 'windows 10.0' })
  })

  it('recognizes Linux desktop (not Android, which is also Linux-kernel but matched first)', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    expect(platformFromUserAgent(ua)).toEqual({ platform: 'linux', osVersion: 'linux 1.0' })
  })

  it('falls back to the fixed default for a missing or unrecognized User-Agent', () => {
    expect(platformFromUserAgent(undefined)).toEqual({ platform: 'windows', osVersion: 'windows 10.0' })
    expect(platformFromUserAgent('some-unknown-bot/1.0')).toEqual({ platform: 'windows', osVersion: 'windows 10.0' })
  })
})

describe('buildSyncGAEvents', () => {
  const baseSave = { version: 1, stats: {} }

  it('emits nothing for an ordinary sync with no new session and no new progress', () => {
    const { events, newPrestigeCountSeen } = buildSyncGAEvents({ save: baseSave, grantedBoss: 0, isNewSession: false, prestigeCountSeen: 0 })
    expect(events).toEqual([])
    expect(newPrestigeCountSeen).toBe(0)
  })

  it('emits a user (session-start) event when isNewSession is true, independent of progress', () => {
    const { events } = buildSyncGAEvents({ save: baseSave, grantedBoss: 0, isNewSession: true, prestigeCountSeen: 0 })
    expect(events).toEqual([{ category: 'user' }])
  })

  it('emits a Boss progression event using the saves deepestBossCleared when grantedBoss > 0', () => {
    const save = { version: 1, stats: { deepestBossCleared: 15 } }
    const { events } = buildSyncGAEvents({ save, grantedBoss: 3, isNewSession: false, prestigeCountSeen: 0 })
    expect(events).toEqual([{ category: 'progression', event_id: 'Complete:Boss:15' }])
  })

  it('does not emit a Boss event when grantedBoss is 0, even if deepestBossCleared is high (a repeat sync)', () => {
    const save = { version: 1, stats: { deepestBossCleared: 15 } }
    const { events } = buildSyncGAEvents({ save, grantedBoss: 0, isNewSession: false, prestigeCountSeen: 0 })
    expect(events).toEqual([])
  })

  it('emits a Prestige progression event only when prestigeCount exceeds prestigeCountSeen, and reports the new high-water mark', () => {
    const save = { version: 1, stats: { prestigeCount: 2 } }
    const unchanged = buildSyncGAEvents({ save, grantedBoss: 0, isNewSession: false, prestigeCountSeen: 2 })
    expect(unchanged.events).toEqual([])
    expect(unchanged.newPrestigeCountSeen).toBe(2)

    const advanced = buildSyncGAEvents({ save, grantedBoss: 0, isNewSession: false, prestigeCountSeen: 1 })
    expect(advanced.events).toEqual([{ category: 'progression', event_id: 'Complete:Prestige:2' }])
    expect(advanced.newPrestigeCountSeen).toBe(2)
  })

  it('can emit all three event kinds in one sync (new session + new boss + new prestige)', () => {
    const save = { version: 1, stats: { deepestBossCleared: 5, prestigeCount: 1 } }
    const { events } = buildSyncGAEvents({ save, grantedBoss: 1, isNewSession: true, prestigeCountSeen: 0 })
    expect(events).toEqual([
      { category: 'user' },
      { category: 'progression', event_id: 'Complete:Boss:5' },
      { category: 'progression', event_id: 'Complete:Prestige:1' },
    ])
  })

  it('treats a missing/non-numeric prestigeCount as 0, never emitting a spurious event', () => {
    const { events, newPrestigeCountSeen } = buildSyncGAEvents({ save: { version: 1 }, grantedBoss: 0, isNewSession: false, prestigeCountSeen: 0 })
    expect(events).toEqual([])
    expect(newPrestigeCountSeen).toBe(0)
  })
})

describe('gaCommonFields', () => {
  it('includes every field GameAnalytics documents as required on every event', () => {
    const fields = gaCommonFields(12345, 'session-uuid', 3)
    expect(fields).toMatchObject({
      v: 2,
      user_id: '12345', // GA's schema wants a string, not our numeric telegram_user_id
      sdk_version: 'rest api v2',
      platform: 'windows',
      session_id: 'session-uuid',
      session_num: 3,
    })
    expect(typeof fields.client_ts).toBe('number')
    expect(fields.client_ts).toBeGreaterThan(0)
  })
})

describe('sendGAEvents', () => {
  it('does nothing (no fetch call) when GA_GAME_KEY/GA_SECRET_KEY are not configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await sendGAEvents({}, [{ category: 'user' }])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does nothing when the event list is empty, even with keys configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await sendGAEvents({ GA_GAME_KEY: 'game123', GA_SECRET_KEY: 'shh' }, [])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs the exact JSON body to /v2/{game_key}/events with a correctly HMAC-SHA256+base64-signed Authorization header', async () => {
    const env = { GA_GAME_KEY: 'game123', GA_SECRET_KEY: 'top-secret' }
    const events = [{ category: 'business', event_id: 'currency:stardust_pack_500', amount: 25, currency: 'XTR' }]
    let captured = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        captured = { url, init }
        return new Response('{}', { status: 200 })
      }),
    )

    await sendGAEvents(env, events)

    expect(captured.url).toBe('https://api.gameanalytics.com/v2/game123/events')
    expect(captured.init.method).toBe('POST')
    expect(captured.init.headers['Content-Type']).toBe('application/json')
    expect(captured.init.body).toBe(JSON.stringify(events))

    // Independently recompute the expected signature via Node's own HMAC implementation (a
    // different crypto backend than this module's Web Crypto call) - if both agree, the signing
    // scheme (HMAC-SHA256 of the raw body, secret key as the hashing key, base64-encoded) matches
    // GameAnalytics' documented algorithm, not just "whatever gameAnalytics.mjs happens to do".
    const expectedAuth = createHmac('sha256', 'top-secret').update(captured.init.body).digest('base64')
    expect(captured.init.headers.Authorization).toBe(expectedAuth)
  })

  it('logs a warning but does not throw when GameAnalytics responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad request', { status: 400 })),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(sendGAEvents({ GA_GAME_KEY: 'g', GA_SECRET_KEY: 's' }, [{ category: 'user' }])).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('logs a warning but does not throw when the network request itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(sendGAEvents({ GA_GAME_KEY: 'g', GA_SECRET_KEY: 's' }, [{ category: 'user' }])).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
