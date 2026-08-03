// Exercises exportRailwaySqlite.mjs against a synthetic SQLite file built with the EXACT schema
// db.mjs still defines today (not the live Railway data - this only proves the export logic is
// correct against a known input; Phase 3 of the plan runs it for real, against the actual pulled
// volume file, separately).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportRailwaySqlite } from './exportRailwaySqlite.mjs'

function buildFixtureDb() {
  const path = join(mkdtempSync(join(tmpdir(), 'sb-export-test-')), 'fixture.db')
  const db = new DatabaseSync(path)
  db.exec(`
    CREATE TABLE purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_user_id INTEGER NOT NULL, item TEXT NOT NULL, created_at INTEGER NOT NULL, claimed_at INTEGER);
    CREATE TABLE saves (telegram_user_id INTEGER PRIMARY KEY, save_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE profiles (telegram_user_id INTEGER PRIMARY KEY, first_name TEXT, username TEXT, photo_url TEXT, first_synced_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, showcase TEXT, gem_sockets TEXT, notifications_enabled INTEGER NOT NULL DEFAULT 1, last_notified_at INTEGER);
    CREATE TABLE referrals (referred_user_id INTEGER PRIMARY KEY, referrer_user_id INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE card_instances (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_user_id INTEGER NOT NULL, card_id TEXT NOT NULL, holo INTEGER NOT NULL DEFAULT 0, variant TEXT NOT NULL DEFAULT 'standard', serial INTEGER NOT NULL, source TEXT NOT NULL, minted_at INTEGER NOT NULL);
    CREATE TABLE card_counters_v (card_id TEXT NOT NULL, variant TEXT NOT NULL, next_serial INTEGER NOT NULL, PRIMARY KEY (card_id, variant));
    CREATE TABLE packs (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_user_id INTEGER NOT NULL, type TEXT NOT NULL, quality REAL NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, opened_at INTEGER);
    CREATE TABLE pack_progress (telegram_user_id INTEGER PRIMARY KEY, bosses_granted INTEGER NOT NULL DEFAULT 0, since_epic INTEGER NOT NULL DEFAULT 0, since_legendary INTEGER NOT NULL DEFAULT 0, dust INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE daily_pack_progress (telegram_user_id INTEGER PRIMARY KEY, last_streak_granted INTEGER NOT NULL DEFAULT 0);
  `)
  db.prepare('INSERT INTO profiles (telegram_user_id, first_name, username, photo_url, first_synced_at, updated_at, showcase) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    111,
    'Rook',
    'rookino',
    null,
    1000,
    2000,
    JSON.stringify([{ cardId: 'earth', variant: 'standard' }]),
  )
  db.prepare('INSERT INTO saves (telegram_user_id, save_json, updated_at) VALUES (?, ?, ?)').run(111, JSON.stringify({ highestStage: 42 }), 2000)
  db.prepare('INSERT INTO purchases (telegram_user_id, item, created_at, claimed_at) VALUES (?, ?, ?, ?)').run(111, 'starter_pack', 1500, 1600)
  db.prepare('INSERT INTO card_instances (telegram_user_id, card_id, holo, variant, serial, source, minted_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    111,
    'earth',
    0,
    'standard',
    7,
    'pack:meteor',
    1700,
  )
  db.prepare('INSERT INTO packs (telegram_user_id, type, quality, created_at, opened_at) VALUES (?, ?, ?, ?, ?)').run(111, 'meteor', 0.2, 1400, 1700)
  db.prepare('INSERT INTO pack_progress (telegram_user_id, bosses_granted, since_epic, since_legendary, dust) VALUES (?, ?, ?, ?, ?)').run(111, 3, 1, 2, 40)
  db.prepare('INSERT INTO daily_pack_progress (telegram_user_id, last_streak_granted) VALUES (?, ?)').run(111, 20)
  db.prepare('INSERT INTO referrals (referred_user_id, referrer_user_id, created_at) VALUES (?, ?, ?)').run(222, 111, 900)
  db.prepare('INSERT INTO card_counters_v (card_id, variant, next_serial) VALUES (?, ?, ?)').run('earth', 'standard', 8)

  // A second player with only a profile (never synced a save) - proves partial rows export fine.
  db.prepare('INSERT INTO profiles (telegram_user_id, first_name, username, photo_url, first_synced_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(333, 'NeverSynced', null, null, 500, 500)

  db.close()
  return path
}

test('exportRailwaySqlite groups every table by telegram_user_id and carries the two global arrays separately', () => {
  const dbPath = buildFixtureDb()
  // node:sqlite rows are null-prototype objects - round-trip through JSON to compare like plain
  // data, matching how adminImport.mjs actually receives this (a JSON request body).
  const result = JSON.parse(JSON.stringify(exportRailwaySqlite(dbPath)))

  assert.equal(result.referrals.length, 1)
  assert.deepEqual(result.referrals[0], { referred_user_id: 222, referrer_user_id: 111, created_at: 900 })

  assert.equal(result.cardCounters.length, 1)
  assert.deepEqual(result.cardCounters[0], { card_id: 'earth', variant: 'standard', next_serial: 8 })

  const player = result.players['111']
  assert.equal(player.profile.first_name, 'Rook')
  assert.equal(player.save.saveJson, JSON.stringify({ highestStage: 42 }))
  assert.equal(player.purchases.length, 1)
  assert.equal(player.purchases[0].item, 'starter_pack')
  assert.equal(player.cardInstances.length, 1)
  assert.equal(player.cardInstances[0].serial, 7)
  assert.equal(player.cardInstances[0].variant, 'standard')
  assert.equal(player.packs.length, 1)
  assert.equal(player.packProgress.dust, 40)
  assert.equal(player.dailyPackProgress.last_streak_granted, 20)

  const partial = result.players['333']
  assert.equal(partial.profile.first_name, 'NeverSynced')
  assert.equal(partial.save, null)
  assert.deepEqual(partial.purchases, [])
  assert.deepEqual(partial.cardInstances, [])
})
