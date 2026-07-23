import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Point db.mjs at a throwaway file before it opens its connection (module-load time).
process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'sb-db-test-')), 'test.db')
const {
  recordPurchase,
  claimPurchases,
  putSave,
  getSave,
  upsertProfile,
  getProfile,
  getLeaderboard,
  grantPacksFromSave,
  grantDailyPackFromSave,
  listUnopenedPacks,
  openPack,
  getCollection,
  getDust,
  refineInstances,
  craftCard,
  setShowcase,
  recordReferral,
  getReferralCount,
  setNotificationsEnabled,
  getUsersDueForReengagement,
  markNotified,
  hasPurchased,
} = await import('./db.mjs')

test('getSave returns null for a user who never synced', () => {
  assert.equal(getSave(111), null)
})

test('putSave then getSave roundtrips the JSON string', () => {
  const json = JSON.stringify({ version: 1, tapLevel: 12 })
  putSave(222, json)
  assert.equal(getSave(222), json)
})

test('putSave overwrites the previous save for the same user', () => {
  putSave(333, JSON.stringify({ version: 1, tapLevel: 1 }))
  putSave(333, JSON.stringify({ version: 1, tapLevel: 99 }))
  assert.equal(JSON.parse(getSave(333)).tapLevel, 99)
})

test('saves are per-user', () => {
  putSave(444, JSON.stringify({ version: 1, tapLevel: 4 }))
  putSave(555, JSON.stringify({ version: 1, tapLevel: 5 }))
  assert.equal(JSON.parse(getSave(444)).tapLevel, 4)
  assert.equal(JSON.parse(getSave(555)).tapLevel, 5)
})

test('getProfile returns null for an unknown user', () => {
  assert.equal(getProfile(777), null)
})

test('upsertProfile keeps first_synced_at across identity updates and joins the save', () => {
  upsertProfile(888, { firstName: 'Rook', username: 'rookino', photoUrl: null })
  const first = getProfile(888)
  assert.equal(first.first_name, 'Rook')
  assert.equal(first.save_json, null) // never synced a save yet

  upsertProfile(888, { firstName: 'Rook II', username: 'rookino', photoUrl: 'https://t.me/p.jpg' })
  putSave(888, JSON.stringify({ version: 1, highestStage: 42, stats: { deepestStage: 90 } }))
  const second = getProfile(888)
  assert.equal(second.first_name, 'Rook II')
  assert.equal(second.photo_url, 'https://t.me/p.jpg')
  assert.equal(second.first_synced_at, first.first_synced_at)
  assert.equal(JSON.parse(second.save_json).stats.deepestStage, 90)
})

test('getLeaderboard ranks by the requested stat, descending, across users', () => {
  const seed = (id, name, save) => {
    upsertProfile(id, { firstName: name, username: null, photoUrl: null })
    putSave(id, JSON.stringify(save))
  }
  seed(2001, 'Ann', { version: 1, stats: { deepestStage: 40, bossesDefeated: 5 } })
  seed(2002, 'Bo', { version: 1, stats: { deepestStage: 120, bossesDefeated: 2 } })
  seed(2003, 'Cy', { version: 1, stats: { deepestStage: 80, bossesDefeated: 30 } })

  const byStage = getLeaderboard('deepestStage', 10).filter((r) => r.telegramUserId >= 2001 && r.telegramUserId <= 2003)
  assert.deepEqual(
    byStage.map((r) => r.telegramUserId),
    [2002, 2003, 2001],
  )
  assert.equal(byStage[0].firstName, 'Bo')
  assert.equal(byStage[0].value, 120)

  // A DIFFERENT sort key produces a different winner from the same seeded rows.
  const byBosses = getLeaderboard('bossesDefeated', 10).filter((r) => r.telegramUserId >= 2001 && r.telegramUserId <= 2003)
  assert.deepEqual(
    byBosses.map((r) => r.telegramUserId),
    [2003, 2001, 2002],
  )
})

test('getLeaderboard falls back to highestStage for a save with no stats block (legacy save)', () => {
  upsertProfile(2010, { firstName: 'Legacy', username: null, photoUrl: null })
  putSave(2010, JSON.stringify({ version: 1, highestStage: 77 }))
  const row = getLeaderboard('deepestStage', 100).find((r) => r.telegramUserId === 2010)
  assert.equal(row.value, 77)
})

test('getLeaderboard excludes a profile with no synced save', () => {
  upsertProfile(2020, { firstName: 'NeverSynced', username: null, photoUrl: null })
  const rows = getLeaderboard('deepestStage', 100)
  assert.equal(rows.some((r) => r.telegramUserId === 2020), false)
})

test('getLeaderboard rejects an unknown sortBy without touching SQL', () => {
  assert.deepEqual(getLeaderboard('; DROP TABLE saves;--', 10), [])
  assert.deepEqual(getLeaderboard('relics', 10), []) // BigNumber field, deliberately not sortable
  // The saves table must still be intact for every later test in this file.
  assert.equal(getSave(2010) !== null, true)
})

test('getLeaderboard clamps limit into a sane range', () => {
  upsertProfile(2030, { firstName: 'Clamp', username: null, photoUrl: null })
  putSave(2030, JSON.stringify({ version: 1, stats: { deepestStage: 1 } }))
  assert.equal(getLeaderboard('deepestStage', 1000).length <= 100, true)
  assert.equal(getLeaderboard('deepestStage', -5).length >= 1, true)
  assert.equal(getLeaderboard('deepestStage', 0).length >= 1, true)
})

test('pack grants track distinct boss-stage clears from save syncs, idempotently', () => {
  // deepestBossCleared is a STAGE NUMBER (boss stage interval 5), not a raw count -
  // floor(deepestBossCleared / 5) is how many distinct bosses that represents.
  const save = (deepestBossCleared, deepest) => ({ version: 1, highestStage: deepest, stats: { deepestBossCleared, deepestStage: deepest } })
  assert.equal(grantPacksFromSave(500, save(15, 20)), 3) // cleared boss stages 5, 10, 15
  assert.equal(grantPacksFromSave(500, save(15, 20)), 0) // same save re-synced: nothing new
  assert.equal(grantPacksFromSave(500, save(25, 60)), 2) // cleared 20, 25 too (5 uniques total)
  const packs = listUnopenedPacks(500)
  assert.equal(packs.length, 5)
  assert.equal(packs[0].type, 'meteor') // deepest 20 -> giants band
  assert.equal(packs[4].type, 'stellar') // deepest 60 -> star band
})

test('pack grants do not repeat for a boss stage re-cleared after a prestige reset', () => {
  const save = (deepestBossCleared, deepest) => ({ version: 1, highestStage: deepest, stats: { deepestBossCleared, deepestStage: deepest } })
  // First run: clear boss stages 5 and 10, then prestige (stage resets to 1 client-side,
  // but deepestBossCleared - a lifetime high-water mark - stays at 10).
  assert.equal(grantPacksFromSave(501, save(10, 12)), 2)
  // Second run after prestige: re-clears boss stage 5 again (deepestBossCleared can't drop
  // below its previous high-water mark, so the save still reports 10) - no new pack for the
  // boss it's already gotten one from.
  assert.equal(grantPacksFromSave(501, save(10, 6)), 0)
  // Only once genuinely NEW ground is cleared (boss stage 15, past the old high-water mark
  // of 10) does another pack land.
  assert.equal(grantPacksFromSave(501, save(15, 16)), 1)
  assert.equal(listUnopenedPacks(501).length, 3)
})

test('daily pack days (10/20/30) grant idempotently and re-grant after a streak reset', () => {
  const save = (streak) => ({ version: 1, dailyStreak: streak })
  assert.equal(grantDailyPackFromSave(1500, save(5)), 0) // no pack day crossed yet
  assert.equal(grantDailyPackFromSave(1500, save(10)), 1) // crossed day 10
  assert.equal(grantDailyPackFromSave(1500, save(10)), 0) // same sync value re-synced: nothing new
  assert.equal(grantDailyPackFromSave(1500, save(25)), 1) // crossed day 20 (days 21-25 have none)
  assert.equal(grantDailyPackFromSave(1500, save(35)), 1) // crossed day 30 (days 31-35 have none)
  const packs = listUnopenedPacks(1500)
  assert.equal(packs.length, 3)
  assert.deepEqual(
    packs.map((p) => p.type),
    ['meteor', 'stellar', 'deepsky'],
  )
  // A missed day resets DailyRewardService's streak to 1 - a lower reported streak than we've
  // already scanned must be treated as a fresh run, not "nothing new".
  assert.equal(grantDailyPackFromSave(1500, save(10)), 1) // fresh run, crossed day 10 again
  assert.equal(listUnopenedPacks(1500).length, 4)
})

test('daily pack days: a single sync spanning multiple pack days grants all of them, including into a second 30-day loop', () => {
  assert.equal(grantDailyPackFromSave(1600, { version: 1, dailyStreak: 45 }), 4) // days 10, 20, 30, then 10-of-loop-2 (=streak 40)
  assert.deepEqual(
    listUnopenedPacks(1600).map((p) => p.type),
    ['meteor', 'stellar', 'deepsky', 'meteor'],
  )
})

test('openPack mints serialed cards once and refuses re-opens and foreign packs', () => {
  grantPacksFromSave(600, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
  const [pack] = listUnopenedPacks(600)
  const result = openPack(600, pack.id)
  assert.equal(result.packType, 'meteor')
  assert.equal(result.cards.length, 3)
  for (const card of result.cards) assert.ok(card.serial >= 1)

  assert.equal(openPack(600, pack.id), null) // already opened
  assert.equal(openPack(601, pack.id), null) // not the owner
  assert.equal(getCollection(600).length, 3)
  assert.equal(listUnopenedPacks(600).length, 0)
})

test('serials increment globally per card+variant', () => {
  grantPacksFromSave(700, { version: 1, highestStage: 10, stats: { deepestBossCleared: 50, deepestStage: 10 } })
  for (const pack of listUnopenedPacks(700)) openPack(700, pack.id)
  const owned = getCollection(700)
  assert.equal(owned.length, 30) // 10 meteor packs x 3 cards
  // Group by (card, holo): serials within a group must be strictly increasing and unique.
  const groups = new Map()
  for (const c of owned) {
    const key = `${c.card_id}:${c.holo}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c.serial)
  }
  for (const serials of groups.values()) {
    assert.equal(new Set(serials).size, serials.length)
  }
})

test('claimPurchases grants each recorded purchase exactly once', () => {
  recordPurchase(666, 'stardust_pack_500')
  recordPurchase(666, 'stardust_pack_500')
  const first = claimPurchases(666)
  assert.deepEqual(first, [{ item: 'stardust_pack_500' }, { item: 'stardust_pack_500' }])
  assert.deepEqual(claimPurchases(666), [])
})

test('claiming a "buy_pack_<type>" purchase mints a real pack, not just a claim record', () => {
  recordPurchase(667, 'buy_pack_stellar')
  assert.equal(listUnopenedPacks(667).length, 0) // not minted until claimed
  const grants = claimPurchases(667)
  assert.deepEqual(grants, [{ item: 'buy_pack_stellar' }])
  const packs = listUnopenedPacks(667)
  assert.equal(packs.length, 1)
  assert.equal(packs[0].type, 'stellar')
  assert.deepEqual(claimPurchases(667), []) // re-claiming never double-mints
  assert.equal(listUnopenedPacks(667).length, 1)
})

test('claiming "starter_pack" mints its Stellar Pack half alongside the Stardust half', () => {
  recordPurchase(680, 'starter_pack')
  const grants = claimPurchases(680)
  assert.deepEqual(grants, [{ item: 'starter_pack' }])
  const packs = listUnopenedPacks(680)
  assert.equal(packs.length, 1)
  assert.equal(packs[0].type, 'stellar')
})

test('an unknown "buy_pack_<type>" is returned to the caller but mints nothing', () => {
  recordPurchase(668, 'buy_pack_nonexistent')
  const grants = claimPurchases(668)
  assert.deepEqual(grants, [{ item: 'buy_pack_nonexistent' }])
  assert.equal(listUnopenedPacks(668).length, 0)
})

test('hasPurchased reflects a purchase whether or not it has been claimed', () => {
  assert.equal(hasPurchased(669, 'starter_pack'), false)
  recordPurchase(669, 'starter_pack')
  assert.equal(hasPurchased(669, 'starter_pack'), true)
  claimPurchases(669)
  assert.equal(hasPurchased(669, 'starter_pack'), true)
})

test('minted cards carry a variant and getCollection exposes it', () => {
  grantPacksFromSave(800, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
  const [pack] = listUnopenedPacks(800)
  const { cards } = openPack(800, pack.id)
  for (const c of cards) assert.ok(typeof c.variant === 'string' && c.variant.length > 0)
  for (const row of getCollection(800)) assert.ok(typeof row.variant === 'string')
})

// Duplicates are RARE now (5,890-card pool + new-card weighting) - to test the dupe economy,
// flood the smallest pool: singularity packs (deepest stage 145) guarantee a legendary from a
// ~77-card pool, so ~180 legendary pulls exhaust it and must dupe.
function grantManyPacks(userId, waves = 3) {
  for (let w = 1; w <= waves; w++) {
    // w * 20 unique bosses -> w * 20 * 5 (BOSS_STAGE_INTERVAL) as a boss-stage number.
    grantPacksFromSave(userId, { version: 1, highestStage: 145, stats: { deepestBossCleared: w * 100, deepestStage: 145 } })
    for (const pack of listUnopenedPacks(userId)) openPack(userId, pack.id)
  }
}

test('refine converts dupes to dust but never the last copy of a card', () => {
  grantManyPacks(900)
  const owned = getCollection(900)
  const byCard = new Map()
  for (const row of owned) {
    if (!byCard.has(row.card_id)) byCard.set(row.card_id, [])
    byCard.get(row.card_id).push(row)
  }
  const dupeGroup = [...byCard.values()].find((rows) => rows.length >= 2)
  assert.ok(dupeGroup, 'expected at least one duplicate after flooding the legendary pool')

  // Refining one of N>=2 copies works and pays dust...
  const before = getDust(900)
  const result = refineInstances(900, [dupeGroup[0].id])
  assert.ok(result)
  assert.ok(result.dust > before)
  assert.equal(getCollection(900).length, owned.length - 1)

  // ...but refining ALL copies of one card is refused outright (all-or-nothing).
  const single = [...byCard.values()].find((rows) => rows.length === 1)
  assert.ok(single)
  assert.equal(refineInstances(900, [single[0].id]), null)
  // Foreign instances are refused too.
  assert.equal(refineInstances(901, [dupeGroup[1].id]), null)
})

test('craft mints a chosen card + variant for dust, refusing when broke', () => {
  assert.equal(craftCard(1000, 'mercury', 'foil'), null) // 0 dust

  // Fund user 1000 with dust by refining dupes.
  grantManyPacks(1000)
  const byCard = new Map()
  for (const row of getCollection(1000)) {
    if (!byCard.has(row.card_id)) byCard.set(row.card_id, [])
    byCard.get(row.card_id).push(row)
  }
  const spare = [...byCard.values()].filter((rows) => rows.length >= 2).flatMap((rows) => rows.slice(1).map((r) => r.id))
  assert.ok(spare.length > 0)
  refineInstances(1000, spare)

  if (getDust(1000) >= 20) {
    // Crafting a common standard costs 5*4=20 dust.
    const commonCard = craftCard(1000, 'phobos', 'standard')
    assert.ok(commonCard)
    assert.equal(commonCard.variant, 'standard')
    assert.ok(getCollection(1000).some((r) => r.card_id === 'phobos'))
  }
  assert.equal(craftCard(1000, 'not-a-card', 'standard'), null)
  assert.equal(craftCard(1000, 'mercury', 'chrome'), null) // unknown variant
})

test('showcase stores only owned (card, variant) pairs and round-trips via profile', () => {
  grantPacksFromSave(1100, { version: 1, highestStage: 10, stats: { deepestBossCleared: 5, deepestStage: 10 } })
  const [pack] = listUnopenedPacks(1100)
  const { cards } = openPack(1100, pack.id)
  const mine = cards.map((c) => ({ cardId: c.cardId, variant: c.variant }))

  assert.equal(setShowcase(1100, mine.slice(0, 3)), true)
  upsertProfile(1100, { firstName: 'T', username: 't', photoUrl: null })
  assert.deepEqual(JSON.parse(getProfile(1100).showcase), mine.slice(0, 3))

  assert.equal(setShowcase(1100, [{ cardId: 'earth', variant: 'polychrome' }]), false) // not owned
  assert.equal(setShowcase(1100, Array(9).fill(mine[0])), false) // over the cap
})

test('recordReferral is first-touch-wins and getReferralCount aggregates per referrer', () => {
  assert.equal(recordReferral(3001, 3000), true) // 3000 referred 3001
  assert.equal(recordReferral(3001, 9999), false) // already referred - first touch wins
  assert.equal(recordReferral(3002, 3000), true) // 3000 referred 3002 too
  assert.equal(getReferralCount(3000), 2)
  assert.equal(getReferralCount(9999), 0) // blocked by first-touch above, never actually recorded
})

test('recordReferral rejects self-referral', () => {
  assert.equal(recordReferral(3010, 3010), false)
  assert.equal(getReferralCount(3010), 0)
})

test('getUsersDueForReengagement respects notifications_enabled, idle threshold, and cooldown', () => {
  upsertProfile(3100, { firstName: 'Idle', username: null, photoUrl: null })
  putSave(3100, JSON.stringify({ version: 1 }))

  // Effectively-permissive idle/cooldown windows (negative = "even a future timestamp would
  // count"), so this only exercises the notifications_enabled/idle/cooldown gates below, never
  // flaking on the real (sub-millisecond) gap between putSave() and this call.
  assert.ok(getUsersDueForReengagement(-60_000, -60_000).includes(3100))

  setNotificationsEnabled(3100, false)
  assert.ok(!getUsersDueForReengagement(-60_000, -60_000).includes(3100))
  setNotificationsEnabled(3100, true)
  assert.ok(getUsersDueForReengagement(-60_000, -60_000).includes(3100))

  // Not idle enough: a save from moments ago is nowhere near a 10-minute-old threshold.
  assert.ok(!getUsersDueForReengagement(600_000, -60_000).includes(3100))

  // Within cooldown right after a fresh notification.
  markNotified(3100)
  assert.ok(!getUsersDueForReengagement(-60_000, 600_000).includes(3100))
})
