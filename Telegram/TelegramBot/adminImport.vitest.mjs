// Exercises handleAdminImport against a synthetic export payload (same shape
// exportRailwaySqlite.mjs produces) - not live Railway data. Proves the secret guard and the
// D1 + PlayerDO replay logic, independent of Phase 3's actual data pull.
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { handleAdminImport } from './adminImport.mjs'
import { callPlayerDO } from './playerDurableObject.mjs'

function importRequest(body, secret = 'test-secret') {
  return new Request('http://worker/admin/import', {
    method: 'POST',
    headers: secret ? { 'x-admin-import-secret': secret } : {},
    body: JSON.stringify(body),
  })
}

describe('handleAdminImport', () => {
  it('rejects a missing or wrong secret', async () => {
    const withoutSecret = await handleAdminImport(importRequest({}, null), { ...env, ADMIN_IMPORT_SECRET: 'test-secret' })
    expect(withoutSecret.status).toBe(401)

    const wrongSecret = await handleAdminImport(importRequest({}, 'nope'), { ...env, ADMIN_IMPORT_SECRET: 'test-secret' })
    expect(wrongSecret.status).toBe(401)
  })

  it('rejects entirely when ADMIN_IMPORT_SECRET is unset - never accidentally open', async () => {
    const res = await handleAdminImport(importRequest({}, 'anything'), { ...env, ADMIN_IMPORT_SECRET: undefined })
    expect(res.status).toBe(401)
  })

  it('replays a full export: card counters, referrals, and one player with everything populated', async () => {
    const testEnv = { ...env, ADMIN_IMPORT_SECRET: 'test-secret' }
    const telegramUserId = 900001

    const payload = {
      cardCounters: [{ card_id: 'earth', variant: 'standard', next_serial: 8 }],
      referrals: [{ referred_user_id: 900002, referrer_user_id: telegramUserId, created_at: 900 }],
      players: {
        [telegramUserId]: {
          profile: { first_name: 'Rook', username: 'rookino', photo_url: null, first_synced_at: 1000, updated_at: 2000, showcase: null, gem_sockets: null },
          save: { saveJson: JSON.stringify({ highestStage: 42, stats: { deepestStage: 42, bossesDefeated: 3 } }), updatedAt: 2000 },
          purchases: [{ item: 'starter_pack', created_at: 1500, claimed_at: 1600 }],
          cardInstances: [{ card_id: 'earth', variant: 'standard', serial: 7, source: 'pack:meteor', minted_at: 1700 }],
          packs: [{ type: 'meteor', quality: 0.2, created_at: 1400, opened_at: 1700 }],
          packProgress: { bosses_granted: 3, since_epic: 1, since_legendary: 2, dust: 40 },
          dailyPackProgress: { last_streak_granted: 20 },
        },
      },
    }

    const res = await handleAdminImport(importRequest(payload), testEnv)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ imported: 1, total: 1, errors: [] })

    // Global card counter seeded - the NEXT real allocation must continue from 8, not restart at 1.
    const counterRow = await testEnv.DB.prepare('SELECT next_serial FROM card_counters_v WHERE card_id = ? AND variant = ?').bind('earth', 'standard').first()
    expect(counterRow.next_serial).toBe(8)

    // Referral replayed into D1.
    const referralRow = await testEnv.DB.prepare('SELECT referrer_user_id FROM referrals WHERE referred_user_id = ?').bind(900002).first()
    expect(referralRow.referrer_user_id).toBe(telegramUserId)

    // Per-user data replayed into the PlayerDO, serial preserved verbatim (not reallocated).
    const save = await callPlayerDO(testEnv, telegramUserId, 'get-save')
    expect(JSON.parse(save).highestStage).toBe(42)
    const collection = await callPlayerDO(testEnv, telegramUserId, 'get-collection')
    expect(collection).toEqual([expect.objectContaining({ card_id: 'earth', variant: 'standard', serial: 7 })])
    expect(await callPlayerDO(testEnv, telegramUserId, 'get-dust')).toBe(40)
    expect(await callPlayerDO(testEnv, telegramUserId, 'has-purchased', { item: 'starter_pack' })).toBe(true)

    // Leaderboard index seeded from the imported save.
    const indexRow = await testEnv.DB.prepare('SELECT deepest_stage, bosses_defeated, saves_updated_at FROM player_index WHERE telegram_user_id = ?').bind(telegramUserId).first()
    expect(indexRow.deepest_stage).toBe(42)
    expect(indexRow.bosses_defeated).toBe(3)
    expect(indexRow.saves_updated_at).toBe(2000)
  })

  it('re-running the same import never regresses the card counter backward', async () => {
    const testEnv = { ...env, ADMIN_IMPORT_SECRET: 'test-secret' }
    // First: a normal live allocation moves the counter to 5.
    const { allocateSerials } = await import('./d1.mjs')
    await allocateSerials(testEnv, [{ cardId: 'mars', variant: 'foil' }, { cardId: 'mars', variant: 'foil' }, { cardId: 'mars', variant: 'foil' }, { cardId: 'mars', variant: 'foil' }])
    // Then: importing a STALE export snapshot (next_serial: 2, from before those allocations)
    // must not walk the counter backward.
    await handleAdminImport(importRequest({ cardCounters: [{ card_id: 'mars', variant: 'foil', next_serial: 2 }], players: {} }), testEnv)
    const row = await testEnv.DB.prepare('SELECT next_serial FROM card_counters_v WHERE card_id = ? AND variant = ?').bind('mars', 'foil').first()
    expect(row.next_serial).toBe(5)
  })

  it('records a per-player error without failing the whole batch', async () => {
    const testEnv = { ...env, ADMIN_IMPORT_SECRET: 'test-secret' }
    const payload = {
      players: {
        // save.saveJson isn't valid JSON - the per-user leaderboard-sync step throws, caught and
        // reported per-player rather than aborting the rest of the import.
        900010: { profile: null, save: { saveJson: 'not json', updatedAt: 1 }, purchases: [], cardInstances: [], packs: [], packProgress: null, dailyPackProgress: null },
      },
    }
    const res = await handleAdminImport(importRequest(payload), testEnv)
    const body = await res.json()
    expect(body.imported).toBe(0)
    expect(body.total).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].telegramUserId).toBe(900010)
  })
})
