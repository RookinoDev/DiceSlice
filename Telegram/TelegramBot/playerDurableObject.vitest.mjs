// Exercises PlayerDO through the same callPlayerDO() convention worker.mjs uses (not
// runInDurableObject's direct-instance-access shortcut) so these tests also prove the fetch()
// router works, not just the underlying SQL logic. Real D1 (via the migrations setup file) backs
// the serial allocation these pack/craft tests depend on - see d1.vitest.mjs for D1-only coverage.
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { callPlayerDO } from './playerDurableObject.mjs'
import { recordReferral } from './d1.mjs'

// GA_GAME_KEY/GA_SECRET_KEY aren't set anywhere in this test environment, so syncSave's real
// sendGAEvents call silently no-ops on every call by design (see gameAnalytics.mjs) - there's
// nothing to observe from out here. The GA *decision* logic (which events a sync should produce)
// is covered directly and deterministically in gameAnalytics.vitest.mjs's buildSyncGAEvents
// tests instead; the tests below only cover the DO-owned session bookkeeping (get-ga-session),
// which is real, observable behavior independent of whether sendGAEvents actually fires.

let nextUserId = 100000
/** A fresh, never-used telegram_user_id (and therefore a fresh PlayerDO) per call, so tests
 *  never share state even if isolation turns out to be per-file rather than per-test. */
function freshUser() {
  return nextUserId++
}

async function syncSave(userId, save, profileFields = { firstName: 'Test', username: null, photoUrl: null }) {
  return callPlayerDO(env, userId, 'sync-save', { telegramUserId: userId, saveJson: JSON.stringify(save), profileFields })
}

describe('saves', () => {
  it('getSave returns null before any sync', async () => {
    const userId = freshUser()
    expect(await callPlayerDO(env, userId, 'get-save')).toBeNull()
  })

  it('syncSave then getSave roundtrips the JSON, and saves are per-user (per-DO)', async () => {
    const a = freshUser()
    const b = freshUser()
    await syncSave(a, { version: 1, tapLevel: 4 })
    await syncSave(b, { version: 1, tapLevel: 5 })
    expect(JSON.parse(await callPlayerDO(env, a, 'get-save')).tapLevel).toBe(4)
    expect(JSON.parse(await callPlayerDO(env, b, 'get-save')).tapLevel).toBe(5)
  })
})

describe('profile', () => {
  it('getProfile returns null before any sync', async () => {
    const userId = freshUser()
    expect(await callPlayerDO(env, userId, 'get-profile')).toBeNull()
  })

  it('keeps first_synced_at across identity updates and reflects the latest save', async () => {
    const userId = freshUser()
    await syncSave(userId, { version: 1 }, { firstName: 'Rook', username: 'rookino', photoUrl: null })
    const first = await callPlayerDO(env, userId, 'get-profile')
    expect(first.first_name).toBe('Rook')

    await syncSave(userId, { version: 1, highestStage: 42, stats: { deepestStage: 90 } }, { firstName: 'Rook II', username: 'rookino', photoUrl: 'https://t.me/p.jpg' })
    const second = await callPlayerDO(env, userId, 'get-profile')
    expect(second.first_name).toBe('Rook II')
    expect(second.photo_url).toBe('https://t.me/p.jpg')
    expect(second.first_synced_at).toBe(first.first_synced_at)
    expect(JSON.parse(second.save_json).stats.deepestStage).toBe(90)
  })
})

describe('pack grants', () => {
  it('track distinct boss-stage clears from save syncs, idempotently', async () => {
    const userId = freshUser()
    const save = (deepestBossCleared, deepest) => ({ version: 1, highestStage: deepest, stats: { deepestBossCleared, deepestStage: deepest } })
    expect((await syncSave(userId, save(15, 20))).grantedBoss).toBe(3) // cleared boss stages 5, 10, 15
    expect((await syncSave(userId, save(15, 20))).grantedBoss).toBe(0) // same save re-synced: nothing new
    expect((await syncSave(userId, save(25, 60))).grantedBoss).toBe(2) // cleared 20, 25 too
    const packs = await callPlayerDO(env, userId, 'list-unopened-packs')
    expect(packs.length).toBe(5)
    expect(packs[0].type).toBe('meteor') // deepest 20 -> giants band
    expect(packs[4].type).toBe('stellar') // deepest 60 -> star band
  })

  it('do not repeat for a boss stage re-cleared after a prestige reset', async () => {
    const userId = freshUser()
    const save = (deepestBossCleared, deepest) => ({ version: 1, highestStage: deepest, stats: { deepestBossCleared, deepestStage: deepest } })
    expect((await syncSave(userId, save(10, 12))).grantedBoss).toBe(2)
    expect((await syncSave(userId, save(10, 6))).grantedBoss).toBe(0) // re-clears boss stage 5, already granted
    expect((await syncSave(userId, save(15, 16))).grantedBoss).toBe(1) // genuinely new ground
    expect((await callPlayerDO(env, userId, 'list-unopened-packs')).length).toBe(3)
  })

  it('daily pack days (10/20/30) grant idempotently and re-grant after a streak reset', async () => {
    const userId = freshUser()
    const save = (streak) => ({ version: 1, dailyStreak: streak })
    expect((await syncSave(userId, save(5))).grantedDaily).toBe(0)
    expect((await syncSave(userId, save(10))).grantedDaily).toBe(1) // crossed day 10
    expect((await syncSave(userId, save(10))).grantedDaily).toBe(0) // same sync value: nothing new
    expect((await syncSave(userId, save(25))).grantedDaily).toBe(1) // crossed day 20
    expect((await syncSave(userId, save(35))).grantedDaily).toBe(1) // crossed day 30
    const packs = await callPlayerDO(env, userId, 'list-unopened-packs')
    expect(packs.map((p) => p.type)).toEqual(['meteor', 'stellar', 'deepsky'])
    // A missed day resets the streak - a lower reported streak must be treated as a fresh run.
    expect((await syncSave(userId, save(10))).grantedDaily).toBe(1)
    expect((await callPlayerDO(env, userId, 'list-unopened-packs')).length).toBe(4)
  })
})

describe('openPack', () => {
  it('mints serialed cards once and refuses re-opens and foreign packs', async () => {
    const userId = freshUser()
    const other = freshUser()
    await syncSave(userId, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
    const [pack] = await callPlayerDO(env, userId, 'list-unopened-packs')

    const result = await callPlayerDO(env, userId, 'open-pack', { packId: pack.id })
    expect(result.packType).toBe('meteor')
    expect([1, 2, 3, 5]).toContain(result.cards.length) // meteor's count is itself a roll
    for (const card of result.cards) expect(card.serial).toBeGreaterThanOrEqual(1)

    expect(await callPlayerDO(env, userId, 'open-pack', { packId: pack.id })).toBeNull() // already opened
    expect(await callPlayerDO(env, other, 'open-pack', { packId: pack.id })).toBeNull() // not the owner (different DO - never sees this pack id)
    expect((await callPlayerDO(env, userId, 'get-collection')).length).toBe(result.cards.length)
    expect((await callPlayerDO(env, userId, 'list-unopened-packs')).length).toBe(0)
  })

  it('serials increment globally per (card, variant) even across different players', async () => {
    const a = freshUser()
    const b = freshUser()
    await syncSave(a, { version: 1, highestStage: 10, stats: { deepestBossCleared: 50, deepestStage: 10 } })
    await syncSave(b, { version: 1, highestStage: 10, stats: { deepestBossCleared: 50, deepestStage: 10 } })

    const seen = new Map() // `${cardId}:${variant}` -> serials seen so far, across BOTH users
    for (const userId of [a, b]) {
      for (const pack of await callPlayerDO(env, userId, 'list-unopened-packs')) {
        const { cards } = await callPlayerDO(env, userId, 'open-pack', { packId: pack.id })
        for (const c of cards) {
          const key = `${c.cardId}:${c.variant}`
          if (!seen.has(key)) seen.set(key, new Set())
          const set = seen.get(key)
          expect(set.has(c.serial)).toBe(false) // no two mints of the same card+variant share a serial, even across users
          set.add(c.serial)
        }
      }
    }
  })
})

describe('purchases', () => {
  it('claimPurchases grants each recorded purchase exactly once', async () => {
    const userId = freshUser()
    await callPlayerDO(env, userId, 'record-purchase', { item: 'stardust_pack_500' })
    await callPlayerDO(env, userId, 'record-purchase', { item: 'stardust_pack_500' })
    expect(await callPlayerDO(env, userId, 'claim-purchases')).toEqual([{ item: 'stardust_pack_500' }, { item: 'stardust_pack_500' }])
    expect(await callPlayerDO(env, userId, 'claim-purchases')).toEqual([])
  })

  it('claiming a "buy_pack_<type>" purchase mints a real pack, not just a claim record', async () => {
    const userId = freshUser()
    await callPlayerDO(env, userId, 'record-purchase', { item: 'buy_pack_stellar' })
    expect((await callPlayerDO(env, userId, 'list-unopened-packs')).length).toBe(0) // not minted until claimed
    expect(await callPlayerDO(env, userId, 'claim-purchases')).toEqual([{ item: 'buy_pack_stellar' }])
    const packs = await callPlayerDO(env, userId, 'list-unopened-packs')
    expect(packs.length).toBe(1)
    expect(packs[0].type).toBe('stellar')
    expect(await callPlayerDO(env, userId, 'claim-purchases')).toEqual([]) // never double-mints
  })

  it('hasPurchased reflects a purchase whether or not it has been claimed', async () => {
    const userId = freshUser()
    expect(await callPlayerDO(env, userId, 'has-purchased', { item: 'starter_pack' })).toBe(false)
    await callPlayerDO(env, userId, 'record-purchase', { item: 'starter_pack' })
    expect(await callPlayerDO(env, userId, 'has-purchased', { item: 'starter_pack' })).toBe(true)
    await callPlayerDO(env, userId, 'claim-purchases')
    expect(await callPlayerDO(env, userId, 'has-purchased', { item: 'starter_pack' })).toBe(true)
  })

  it('pending invoice reservation expires after its TTL', async () => {
    const userId = freshUser()
    expect(await callPlayerDO(env, userId, 'has-pending-invoice', { itemId: 'offline_cap_boost' })).toBe(false)
    await callPlayerDO(env, userId, 'reserve-pending-invoice', { itemId: 'offline_cap_boost', ttlMs: 100000 })
    expect(await callPlayerDO(env, userId, 'has-pending-invoice', { itemId: 'offline_cap_boost' })).toBe(true)
    await callPlayerDO(env, userId, 'reserve-pending-invoice', { itemId: 'offline_cap_boost', ttlMs: -1 }) // already expired
    expect(await callPlayerDO(env, userId, 'has-pending-invoice', { itemId: 'offline_cap_boost' })).toBe(false)
  })
})

describe('refine and craft', () => {
  // Duplicates are rare with the real 5,890-card pool - flood a small pool (singularity packs,
  // deepest stage 145, guarantee a legendary from a ~77-card pool) so dupes show up reliably.
  async function grantManyPacksAndOpen(userId, waves = 3) {
    for (let w = 1; w <= waves; w++) {
      await syncSave(userId, { version: 1, highestStage: 145, stats: { deepestBossCleared: w * 100, deepestStage: 145 } })
      for (const pack of await callPlayerDO(env, userId, 'list-unopened-packs')) {
        await callPlayerDO(env, userId, 'open-pack', { packId: pack.id })
      }
    }
  }

  it('refine converts dupes to dust but never the last copy of a card', async () => {
    const userId = freshUser()
    await grantManyPacksAndOpen(userId)
    const owned = await callPlayerDO(env, userId, 'get-collection')
    const byCard = new Map()
    for (const row of owned) {
      if (!byCard.has(row.card_id)) byCard.set(row.card_id, [])
      byCard.get(row.card_id).push(row)
    }
    const dupeGroup = [...byCard.values()].find((rows) => rows.length >= 2)
    expect(dupeGroup, 'expected at least one duplicate after flooding the legendary pool').toBeTruthy()

    const before = await callPlayerDO(env, userId, 'get-dust')
    const result = await callPlayerDO(env, userId, 'refine-instances', { instanceIds: [dupeGroup[0].id] })
    expect(result).toBeTruthy()
    expect(result.dust).toBeGreaterThan(before)
    expect((await callPlayerDO(env, userId, 'get-collection')).length).toBe(owned.length - 1)

    // Refining the LAST copy of a card must fail (rejects the whole batch, no partial refine).
    const lastCopy = (await callPlayerDO(env, userId, 'get-collection')).filter((r) => r.card_id === dupeGroup[0].card_id)
    if (lastCopy.length === 1) {
      const failResult = await callPlayerDO(env, userId, 'refine-instances', { instanceIds: [lastCopy[0].id] })
      expect(failResult).toBeNull()
    }
  })

  it('craftCard costs dust, mints a serialed card, and refuses when dust is insufficient', async () => {
    const userId = freshUser()
    expect(await callPlayerDO(env, userId, 'craft-card', { cardId: 'earth', variant: 'standard' })).toBeNull() // no dust yet
    await grantManyPacksAndOpen(userId, 4)
    // Refine everything refinable into a big dust pile, then craft with it.
    const owned = await callPlayerDO(env, userId, 'get-collection')
    const byCard = new Map()
    for (const row of owned) {
      if (!byCard.has(row.card_id)) byCard.set(row.card_id, [])
      byCard.get(row.card_id).push(row)
    }
    for (const rows of byCard.values()) {
      if (rows.length >= 2) await callPlayerDO(env, userId, 'refine-instances', { instanceIds: [rows[0].id] })
    }
    const dust = await callPlayerDO(env, userId, 'get-dust')
    if (dust > 0) {
      const result = await callPlayerDO(env, userId, 'craft-card', { cardId: owned[0].card_id, variant: 'standard' })
      // Either affordable (mints) or not (null) depending on how much dust the flood produced -
      // both are valid outcomes; what matters is it never throws and never mints without paying.
      if (result) {
        expect(result.serial).toBeGreaterThanOrEqual(1)
        expect(result.dust).toBe(dust - result.cost)
      }
    }
  })
})

describe('showcase and gem sockets', () => {
  it('setShowcase rejects an unowned card and accepts an owned one', async () => {
    const userId = freshUser()
    expect(await callPlayerDO(env, userId, 'set-showcase', { cards: [{ cardId: 'earth', variant: 'standard' }] })).toBe(false)

    await syncSave(userId, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
    let minted
    for (const pack of await callPlayerDO(env, userId, 'list-unopened-packs')) {
      const r = await callPlayerDO(env, userId, 'open-pack', { packId: pack.id })
      if (r.cards.length > 0) minted = r.cards[0]
    }
    expect(await callPlayerDO(env, userId, 'set-showcase', { cards: [{ cardId: minted.cardId, variant: minted.variant }] })).toBe(true)
    expect((await callPlayerDO(env, userId, 'get-profile')).showcase).toBeTruthy()
  })

  it('setGemSockets rejects a duplicate nodeId and an unowned card', async () => {
    const userId = freshUser()
    await syncSave(userId, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
    let minted
    for (const pack of await callPlayerDO(env, userId, 'list-unopened-packs')) {
      const r = await callPlayerDO(env, userId, 'open-pack', { packId: pack.id })
      if (r.cards.length > 0) minted = r.cards[0]
    }
    const ok = await callPlayerDO(env, userId, 'set-gem-sockets', { sockets: [{ nodeId: 'node-a', cardId: minted.cardId, variant: minted.variant }] })
    expect(ok).toBe(true)
    expect(await callPlayerDO(env, userId, 'get-gem-sockets')).toEqual([{ nodeId: 'node-a', cardId: minted.cardId, variant: minted.variant }])

    const dupeNodeIds = await callPlayerDO(env, userId, 'set-gem-sockets', {
      sockets: [
        { nodeId: 'node-a', cardId: minted.cardId, variant: minted.variant },
        { nodeId: 'node-a', cardId: minted.cardId, variant: minted.variant },
      ],
    })
    expect(dupeNodeIds).toBe(false)

    const unowned = await callPlayerDO(env, userId, 'set-gem-sockets', { sockets: [{ nodeId: 'node-b', cardId: 'not-owned-card', variant: 'standard' }] })
    expect(unowned).toBe(false)
  })
})

describe('reset', () => {
  it('resetPlayerCollection clears cards/packs/dust/showcase but not the save', async () => {
    const userId = freshUser()
    await syncSave(userId, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
    expect((await callPlayerDO(env, userId, 'list-unopened-packs')).length).toBeGreaterThan(0)

    await callPlayerDO(env, userId, 'reset-player-collection')
    expect((await callPlayerDO(env, userId, 'list-unopened-packs')).length).toBe(0)
    expect((await callPlayerDO(env, userId, 'get-collection')).length).toBe(0)
    expect(await callPlayerDO(env, userId, 'get-dust')).toBe(0)
    expect(await callPlayerDO(env, userId, 'get-gem-sockets')).toEqual([])
    expect(await callPlayerDO(env, userId, 'get-save')).not.toBeNull() // the save itself is untouched
  })
})

describe('referral rewards', () => {
  it('grants the referrer exactly once, on the referred players first save sync (not on later ones)', async () => {
    const referrer = freshUser()
    const referred = freshUser()
    expect(await recordReferral(env, referred, referrer)).toBe(true)

    await syncSave(referred, { version: 1 }) // referred player's first sync - the trigger
    const firstClaim = await callPlayerDO(env, referrer, 'claim-purchases')
    expect(firstClaim.filter((g) => g.item === 'referral_reward')).toHaveLength(1)

    await syncSave(referred, { version: 1, highestStage: 5 }) // a later sync, not their first
    const secondClaim = await callPlayerDO(env, referrer, 'claim-purchases')
    expect(secondClaim.filter((g) => g.item === 'referral_reward')).toHaveLength(0)
  })

  it('does nothing when the syncing player was never referred', async () => {
    const userId = freshUser()
    await expect(syncSave(userId, { version: 1 })).resolves.toBeTruthy() // just proving it doesn't throw
  })
})

describe('VIP expiry sync to D1', () => {
  it('converts the saves epoch-seconds vipExpiresUnixSeconds into epoch-ms in player_index', async () => {
    const userId = freshUser()
    const expiresSeconds = Math.floor(Date.now() / 1000) + 3600
    await syncSave(userId, { version: 1, vipExpiresUnixSeconds: expiresSeconds })
    const row = await env.DB.prepare('SELECT vip_expires_at FROM player_index WHERE telegram_user_id = ?').bind(userId).first()
    expect(row.vip_expires_at).toBe(expiresSeconds * 1000)
  })

  it('stores null (not 0) when the save has no VIP purchase', async () => {
    const userId = freshUser()
    await syncSave(userId, { version: 1 })
    const row = await env.DB.prepare('SELECT vip_expires_at FROM player_index WHERE telegram_user_id = ?').bind(userId).first()
    expect(row.vip_expires_at).toBeNull()
  })
})

describe('GameAnalytics session tracking (get-ga-session)', () => {
  it('starts session_num at 1 on first use and reuses the same session_id/session_num on the next call', async () => {
    const userId = freshUser()
    const first = await callPlayerDO(env, userId, 'get-ga-session', {})
    expect(first.sessionNum).toBe(1)
    expect(first.sessionId).toEqual(expect.any(String))

    const second = await callPlayerDO(env, userId, 'get-ga-session', {})
    expect(second.sessionId).toBe(first.sessionId)
    expect(second.sessionNum).toBe(1)
  })

  it('keeps sessions independent per player', async () => {
    const a = await callPlayerDO(env, freshUser(), 'get-ga-session', {})
    const b = await callPlayerDO(env, freshUser(), 'get-ga-session', {})
    expect(a.sessionId).not.toBe(b.sessionId)
  })

  it('increments purchase_num only when incrementPurchase is passed, and leaves session identity untouched', async () => {
    const userId = freshUser()
    const ambient = await callPlayerDO(env, userId, 'get-ga-session', {})
    expect(ambient.purchaseNum).toBeNull()

    const first = await callPlayerDO(env, userId, 'get-ga-session', { incrementPurchase: true })
    expect(first.purchaseNum).toBe(1)
    expect(first.sessionId).toBe(ambient.sessionId) // getting a purchase number doesn't start a new session

    const second = await callPlayerDO(env, userId, 'get-ga-session', { incrementPurchase: true })
    expect(second.purchaseNum).toBe(2)
  })

  it('detects and persists platform/os_version from a real User-Agent, per player - not a fixed value for everyone', async () => {
    const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
    const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15'

    const androidUser = await callPlayerDO(env, freshUser(), 'get-ga-session', { userAgent: androidUA })
    expect(androidUser).toMatchObject({ platform: 'android', osVersion: 'android 14' })

    const iosUser = await callPlayerDO(env, freshUser(), 'get-ga-session', { userAgent: iosUA })
    expect(iosUser).toMatchObject({ platform: 'ios', osVersion: 'ios 17.4' })
  })

  it('reuses the last-detected platform when a later call has no User-Agent of its own (the payment webhook case)', async () => {
    const userId = freshUser()
    await callPlayerDO(env, userId, 'get-ga-session', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' })

    const webhookLike = await callPlayerDO(env, userId, 'get-ga-session', { incrementPurchase: true }) // no userAgent
    expect(webhookLike).toMatchObject({ platform: 'android', osVersion: 'android 14' })
  })
})

describe('syncSave does not error with GameAnalytics wired in but no credentials configured', () => {
  it('a sync that would normally emit session/progression/prestige events still succeeds', async () => {
    const userId = freshUser()
    await expect(syncSave(userId, { version: 1, stats: { deepestBossCleared: 5, deepestStage: 6, prestigeCount: 1 } })).resolves.toBeTruthy()
  })
})
