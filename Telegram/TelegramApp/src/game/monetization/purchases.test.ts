import { describe, expect, it } from 'vitest'
import { createGameSession } from '../createGameSession'
import { applyGrants } from './purchases'

const nowSeconds = () => Math.floor(Date.now() / 1000)
const THIRTY_DAYS = 30 * 24 * 60 * 60

describe('applyGrants', () => {
  it('offline_cap_boost adds 16 hours to the session', () => {
    const session = createGameSession()
    applyGrants(session, [{ item: 'offline_cap_boost' }])
    expect(session.boosts.offlineCapBonusHours).toBe(16)
  })

  it('vip_pass_30d grants ~30 days from now on a first purchase', () => {
    const session = createGameSession()
    applyGrants(session, [{ item: 'vip_pass_30d' }])
    expect(session.boosts.vipExpiresUnixSeconds).toBeGreaterThanOrEqual(nowSeconds() + THIRTY_DAYS - 2)
    expect(session.boosts.vipExpiresUnixSeconds).toBeLessThanOrEqual(nowSeconds() + THIRTY_DAYS + 2)
  })

  it('repurchasing vip_pass_30d while still active extends from the current expiry, not from now', () => {
    const session = createGameSession()
    session.boosts.vipExpiresUnixSeconds = nowSeconds() + THIRTY_DAYS // e.g. 29 days still remaining
    applyGrants(session, [{ item: 'vip_pass_30d' }])
    // Should land ~60 days out, not ~30 - an early repurchase must never waste remaining time.
    expect(session.boosts.vipExpiresUnixSeconds).toBeGreaterThanOrEqual(nowSeconds() + THIRTY_DAYS * 2 - 2)
  })

  it('repurchasing vip_pass_30d after it lapsed extends from now, not from the stale past expiry', () => {
    const session = createGameSession()
    session.boosts.vipExpiresUnixSeconds = nowSeconds() - THIRTY_DAYS // lapsed a month ago
    applyGrants(session, [{ item: 'vip_pass_30d' }])
    expect(session.boosts.vipExpiresUnixSeconds).toBeGreaterThanOrEqual(nowSeconds() + THIRTY_DAYS - 2)
    expect(session.boosts.vipExpiresUnixSeconds).toBeLessThanOrEqual(nowSeconds() + THIRTY_DAYS + 2)
  })

  it('unknown grant items are ignored without throwing', () => {
    const session = createGameSession()
    expect(() => applyGrants(session, [{ item: 'not_a_real_item' }])).not.toThrow()
  })
})
