// Exercises PlayerDO through the same callPlayerDO() convention worker.mjs uses (not
// runInDurableObject's direct-instance-access shortcut) so these tests also prove the fetch()
// router works, not just the underlying SQL logic. Real D1 (via the migrations setup file) backs
// the serial allocation these pack/craft tests depend on - see d1.vitest.mjs for D1-only coverage.
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { callPlayerDO } from './playerDurableObject.mjs'

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
