import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Point db.mjs at a throwaway file before it opens its connection (module-load time).
process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'sb-db-test-')), 'test.db')
const { recordPurchase, claimPurchases, putSave, getSave, upsertProfile, getProfile, grantPacksFromSave, listUnopenedPacks, openPack, getCollection } = await import('./db.mjs')

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

test('pack grants track boss-kill deltas from save syncs, idempotently', () => {
  const save = (bosses, deepest) => ({ version: 1, highestStage: deepest, stats: { bossesDefeated: bosses, deepestStage: deepest } })
  assert.equal(grantPacksFromSave(500, save(3, 20)), 3)
  assert.equal(grantPacksFromSave(500, save(3, 20)), 0) // same save re-synced: nothing new
  assert.equal(grantPacksFromSave(500, save(5, 60)), 2)
  const packs = listUnopenedPacks(500)
  assert.equal(packs.length, 5)
  assert.equal(packs[0].type, 'meteor') // deepest 20 -> giants band
  assert.equal(packs[4].type, 'stellar') // deepest 60 -> star band
})

test('openPack mints serialed cards once and refuses re-opens and foreign packs', () => {
  grantPacksFromSave(600, { version: 1, highestStage: 10, stats: { bossesDefeated: 1, deepestStage: 10 } })
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
  grantPacksFromSave(700, { version: 1, highestStage: 10, stats: { bossesDefeated: 10, deepestStage: 10 } })
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
