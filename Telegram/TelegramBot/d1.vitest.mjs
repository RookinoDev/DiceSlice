// Exercises d1.mjs against the real D1 binding (via @cloudflare/vitest-pool-workers) - not
// mocked, since the whole point of these functions is relying on D1's real single-writer
// atomicity (allocateSerials) and real SQL semantics (ON CONFLICT, json-free column sorting).
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import {
  allocateSerials,
  getAdminStats,
  getLeaderboard,
  getReferralCount,
  getUsersDueForReengagement,
  markNotified,
  recordEvent,
  recordReferral,
  setNotificationsEnabled,
  syncLeaderboardStats,
  upsertProfileIdentity,
} from './d1.mjs'

describe('allocateSerials', () => {
  it('allocates sequential serials per (cardId, variant), starting at 1', async () => {
    const [a, b, c] = await allocateSerials(env, [
      { cardId: 'earth', variant: 'standard' },
      { cardId: 'earth', variant: 'standard' },
      { cardId: 'earth', variant: 'standard' },
    ])
    expect([a, b, c]).toEqual([a, a + 1, a + 2])
  })

  it('keeps separate counters per variant of the same card', async () => {
    const [standard] = await allocateSerials(env, [{ cardId: 'mars', variant: 'standard' }])
    const [holo] = await allocateSerials(env, [{ cardId: 'mars', variant: 'holo' }])
    const [standard2] = await allocateSerials(env, [{ cardId: 'mars', variant: 'standard' }])
    expect(standard2).toBe(standard + 1)
    expect(holo).toBe(1) // its own counter, unaffected by 'standard' allocations
  })

  it('handles two requests for the same (cardId, variant) in one call sequentially (a pack rolling two copies of a never-owned card)', async () => {
    const [a, b] = await allocateSerials(env, [
      { cardId: 'jupiter', variant: 'foil' },
      { cardId: 'jupiter', variant: 'foil' },
    ])
    expect(b).toBe(a + 1)
  })

  it('returns [] for an empty request list without touching D1', async () => {
    expect(await allocateSerials(env, [])).toEqual([])
  })
})

describe('leaderboard index', () => {
  it('ranks by the requested stat, descending, and excludes never-synced users', async () => {
    await upsertProfileIdentity(env, 3001, { firstName: 'Ann', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 3001, { deepestStage: 40, bossesDefeated: 5, prestigeCount: 0, deepestBossCleared: 40 })
    await upsertProfileIdentity(env, 3002, { firstName: 'Bo', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 3002, { deepestStage: 120, bossesDefeated: 2, prestigeCount: 0, deepestBossCleared: 120 })
    await upsertProfileIdentity(env, 3003, { firstName: 'NeverSynced', username: null, photoUrl: null }) // never calls syncLeaderboardStats

    const rows = await getLeaderboard(env, 'deepestStage', 10)
    const relevant = rows.filter((r) => r.telegramUserId === 3001 || r.telegramUserId === 3002 || r.telegramUserId === 3003)
    expect(relevant.map((r) => r.telegramUserId)).toEqual([3002, 3001])
    expect(relevant[0].firstName).toBe('Bo')
    expect(relevant[0].value).toBe(120)
  })

  it('returns [] for an unknown sortBy without touching SQL', async () => {
    expect(await getLeaderboard(env, '; DROP TABLE player_index;--', 10)).toEqual([])
    expect(await getLeaderboard(env, 'relics', 10)).toEqual([]) // BigNumber field, deliberately not sortable
  })

  it('clamps limit into a sane range', async () => {
    await upsertProfileIdentity(env, 3010, { firstName: 'Clamp', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 3010, { deepestStage: 1, bossesDefeated: 0, prestigeCount: 0, deepestBossCleared: 0 })
    expect((await getLeaderboard(env, 'deepestStage', 1000)).length).toBeLessThanOrEqual(100)
    expect((await getLeaderboard(env, 'deepestStage', -5)).length).toBeGreaterThanOrEqual(1)
  })
})

describe('re-engagement scan', () => {
  it('only includes notifications-enabled, idle-past-threshold, not-recently-notified users with a synced save', async () => {
    const now = Date.now()
    const idleMs = 24 * 60 * 60 * 1000
    const cooldownMs = 20 * 60 * 60 * 1000

    // Due: idle, enabled, never notified.
    await upsertProfileIdentity(env, 4001, { firstName: 'Due', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 4001, { deepestStage: 1, bossesDefeated: 0, prestigeCount: 0, deepestBossCleared: 0 })
    await env.DB.prepare('UPDATE player_index SET saves_updated_at = ? WHERE telegram_user_id = ?').bind(now - idleMs - 1000, 4001).run()

    // Not due: notifications disabled.
    await upsertProfileIdentity(env, 4002, { firstName: 'Opted out', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 4002, { deepestStage: 1, bossesDefeated: 0, prestigeCount: 0, deepestBossCleared: 0 })
    await env.DB.prepare('UPDATE player_index SET saves_updated_at = ? WHERE telegram_user_id = ?').bind(now - idleMs - 1000, 4002).run()
    await setNotificationsEnabled(env, 4002, false)

    // Not due: recently notified (inside cooldown).
    await upsertProfileIdentity(env, 4003, { firstName: 'Recently notified', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 4003, { deepestStage: 1, bossesDefeated: 0, prestigeCount: 0, deepestBossCleared: 0 })
    await env.DB.prepare('UPDATE player_index SET saves_updated_at = ?, last_notified_at = ? WHERE telegram_user_id = ?').bind(now - idleMs - 1000, now - 1000, 4003).run()

    // Not due: not idle long enough.
    await upsertProfileIdentity(env, 4004, { firstName: 'Still active', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 4004, { deepestStage: 1, bossesDefeated: 0, prestigeCount: 0, deepestBossCleared: 0 })

    const due = await getUsersDueForReengagement(env, idleMs, cooldownMs)
    expect(due).toContain(4001)
    expect(due).not.toContain(4002)
    expect(due).not.toContain(4003)
    expect(due).not.toContain(4004)
  })

  it('markNotified starts the cooldown window', async () => {
    const now = Date.now()
    const idleMs = 24 * 60 * 60 * 1000
    const cooldownMs = 20 * 60 * 60 * 1000
    await upsertProfileIdentity(env, 4010, { firstName: 'X', username: null, photoUrl: null })
    await syncLeaderboardStats(env, 4010, { deepestStage: 1, bossesDefeated: 0, prestigeCount: 0, deepestBossCleared: 0 })
    await env.DB.prepare('UPDATE player_index SET saves_updated_at = ? WHERE telegram_user_id = ?').bind(now - idleMs - 1000, 4010).run()

    expect(await getUsersDueForReengagement(env, idleMs, cooldownMs)).toContain(4010)
    await markNotified(env, 4010)
    expect(await getUsersDueForReengagement(env, idleMs, cooldownMs)).not.toContain(4010)
  })
})

describe('referrals', () => {
  it('first touch wins - a later /start with a different referrer is a no-op', async () => {
    expect(await recordReferral(env, 5001, 9001)).toBe(true)
    expect(await recordReferral(env, 5001, 9002)).toBe(false)
    expect(await getReferralCount(env, 9001)).toBe(1)
    expect(await getReferralCount(env, 9002)).toBe(0)
  })

  it('self-referral is a no-op', async () => {
    expect(await recordReferral(env, 5010, 5010)).toBe(false)
  })
})

describe('analytics events', () => {
  it('getAdminStats aggregates revenue, per-item conversion, and DAU from recorded events', async () => {
    // Two invoices opened for the same SKU, only one completes - the classic funnel this exists
    // to measure (conversionRate should land on exactly 0.5, not silently divide-by-zero).
    await recordEvent(env, { type: 'invoice_created', telegramUserId: 6001, item: 'stardust_pack_500', valueStars: 25 })
    await recordEvent(env, { type: 'invoice_created', telegramUserId: 6002, item: 'stardust_pack_500', valueStars: 25 })
    await recordEvent(env, { type: 'purchase_completed', telegramUserId: 6001, item: 'stardust_pack_500', valueStars: 25 })
    await recordEvent(env, { type: 'session', telegramUserId: 6001 })
    await recordEvent(env, { type: 'session', telegramUserId: 6002 })

    const stats = await getAdminStats(env)
    expect(stats.totalPurchases).toBeGreaterThanOrEqual(1)
    expect(stats.totalRevenueStars).toBeGreaterThanOrEqual(25)
    const row = stats.conversionByItem.find((r) => r.item === 'stardust_pack_500')
    expect(row.invoices).toBeGreaterThanOrEqual(2)
    expect(row.purchases).toBeGreaterThanOrEqual(1)
    expect(row.conversionRate).toBeCloseTo(row.purchases / row.invoices)
    expect(stats.dailyActiveUsers).toBeGreaterThanOrEqual(2) // the two 'session' events just recorded, at minimum
  })

  it('a purchase_completed event with no matching invoice still counts as revenue (conversionRate stays null, not NaN)', async () => {
    await recordEvent(env, { type: 'purchase_completed', telegramUserId: 6010, item: 'vip_pass_30d', valueStars: 99 })
    const stats = await getAdminStats(env)
    const row = stats.conversionByItem.find((r) => r.item === 'vip_pass_30d')
    expect(row.invoices).toBe(0)
    expect(row.conversionRate).toBeNull()
  })

  it('recordEvent never throws even if D1 rejects the write (analytics must not break the caller)', async () => {
    await expect(recordEvent({ DB: { prepare: () => ({ bind: () => ({ run: () => Promise.reject(new Error('boom')) }) }) } }, { type: 'session', telegramUserId: 1 })).resolves.toBeUndefined()
  })
})
