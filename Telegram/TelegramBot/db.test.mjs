import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Point db.mjs at a throwaway file before it opens its connection (module-load time).
process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'sb-db-test-')), 'test.db')
const { recordPurchase, claimPurchases, putSave, getSave, upsertProfile, getProfile } = await import('./db.mjs')

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

test('claimPurchases grants each recorded purchase exactly once', () => {
  recordPurchase(666, 'stardust_pack_500')
  recordPurchase(666, 'stardust_pack_500')
  const first = claimPurchases(666)
  assert.deepEqual(first, [{ item: 'stardust_pack_500' }, { item: 'stardust_pack_500' }])
  assert.deepEqual(claimPurchases(666), [])
})
