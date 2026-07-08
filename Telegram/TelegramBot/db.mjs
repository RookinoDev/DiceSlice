import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// /data is a Railway Volume mount (persists across redeploys). Falls back to a local
// file in dev so this works without any volume configured.
const DB_PATH = process.env.SQLITE_PATH || (existsSync('/data') ? '/data/purchases.db' : './purchases.local.db')

const dir = dirname(DB_PATH)
if (dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true })

const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    claimed_at INTEGER
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS saves (
    telegram_user_id INTEGER PRIMARY KEY,
    save_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    telegram_user_id INTEGER PRIMARY KEY,
    first_name TEXT,
    username TEXT,
    photo_url TEXT,
    first_synced_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

// --- Collectible cards (see docs/CARD_SYSTEM_PLAN.md) ---
// Instances are serial-numbered per (card, holo): mint #N is a real, ownable object.
db.exec(`
  CREATE TABLE IF NOT EXISTS card_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    holo INTEGER NOT NULL DEFAULT 0,
    serial INTEGER NOT NULL,
    source TEXT NOT NULL,
    minted_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_card_mint ON card_instances(card_id, holo, serial);
  CREATE INDEX IF NOT EXISTS ix_card_owner ON card_instances(telegram_user_id);

  CREATE TABLE IF NOT EXISTS card_counters (
    card_id TEXT NOT NULL,
    holo INTEGER NOT NULL,
    next_serial INTEGER NOT NULL,
    PRIMARY KEY (card_id, holo)
  );

  CREATE TABLE IF NOT EXISTS packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    opened_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS ix_packs_owner ON packs(telegram_user_id);

  CREATE TABLE IF NOT EXISTS pack_progress (
    telegram_user_id INTEGER PRIMARY KEY,
    bosses_granted INTEGER NOT NULL DEFAULT 0,
    since_epic INTEGER NOT NULL DEFAULT 0,
    since_legendary INTEGER NOT NULL DEFAULT 0
  )
`)

/** Upsert the player's public identity (from Telegram-signed initData). Keeps first_synced_at. */
export function upsertProfile(telegramUserId, { firstName, username, photoUrl }) {
  const now = Date.now()
  db.prepare(`
    INSERT INTO profiles (telegram_user_id, first_name, username, photo_url, first_synced_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      first_name = excluded.first_name, username = excluded.username,
      photo_url = excluded.photo_url, updated_at = excluded.updated_at
  `).run(telegramUserId, firstName ?? null, username ?? null, photoUrl ?? null, now, now)
}

/** Public profile: identity row + the synced save JSON (null when the user never synced). */
export function getProfile(telegramUserId) {
  const row = db
    .prepare(
      `SELECT p.telegram_user_id, p.first_name, p.username, p.photo_url, p.first_synced_at, s.save_json
       FROM profiles p LEFT JOIN saves s ON s.telegram_user_id = p.telegram_user_id
       WHERE p.telegram_user_id = ?`,
    )
    .get(telegramUserId)
  return row ?? null
}

/** Upsert the user's cloud save (last write wins - the client decides which save is better). */
export function putSave(telegramUserId, saveJson) {
  db.prepare(`
    INSERT INTO saves (telegram_user_id, save_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at
  `).run(telegramUserId, saveJson, Date.now())
}

/** The user's cloud save JSON string, or null if they never synced. */
export function getSave(telegramUserId) {
  const row = db.prepare('SELECT save_json FROM saves WHERE telegram_user_id = ?').get(telegramUserId)
  return row ? row.save_json : null
}

// --- Card packs ---
import { packTypeForBossStage, rollPack } from './cards.mjs'

/** Cap on packs granted per single save sync - a sanity brake, not a balance knob. */
const MAX_PACKS_PER_SYNC = 20

/**
 * Grants packs for boss kills revealed by a cloud-save sync: the delta between the
 * save's lifetime bossesDefeated and what we've granted for already. Pack type is
 * inferred from the save's deepest stage (recent bosses cluster near it). Trust model:
 * client-authoritative progress, server-authoritative grants - see the plan doc.
 */
export function grantPacksFromSave(telegramUserId, save) {
  const defeated = Number(save?.stats?.bossesDefeated)
  if (!Number.isFinite(defeated) || defeated <= 0) return 0
  const deepest = Math.max(Number(save?.stats?.deepestStage) || 1, Number(save?.highestStage) || 1)

  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT OR IGNORE INTO pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    const progress = db.prepare('SELECT bosses_granted FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
    const delta = Math.min(Math.floor(defeated) - progress.bosses_granted, MAX_PACKS_PER_SYNC)
    if (delta <= 0) {
      db.exec('COMMIT')
      return 0
    }
    const type = packTypeForBossStage(deepest)
    const insert = db.prepare('INSERT INTO packs (telegram_user_id, type, created_at) VALUES (?, ?, ?)')
    for (let i = 0; i < delta; i++) insert.run(telegramUserId, type, now)
    db.prepare('UPDATE pack_progress SET bosses_granted = bosses_granted + ? WHERE telegram_user_id = ?').run(delta, telegramUserId)
    db.exec('COMMIT')
    return delta
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function listUnopenedPacks(telegramUserId) {
  return db.prepare('SELECT id, type, created_at FROM packs WHERE telegram_user_id = ? AND opened_at IS NULL ORDER BY id').all(telegramUserId)
}

/**
 * Opens a pack atomically: verifies ownership, rolls contents (with the user's pity
 * counters), mints serial-numbered instances, marks the pack opened. Returns the
 * minted cards or null if the pack isn't openable (wrong owner / already opened).
 */
export function openPack(telegramUserId, packId) {
  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    const pack = db.prepare('SELECT id, type FROM packs WHERE id = ? AND telegram_user_id = ? AND opened_at IS NULL').get(packId, telegramUserId)
    if (!pack) {
      db.exec('COMMIT')
      return null
    }

    db.prepare('INSERT OR IGNORE INTO pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    const progress = db.prepare('SELECT since_epic, since_legendary FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
    const { cards, pity } = rollPack(pack.type, { sinceEpic: progress.since_epic, sinceLegendary: progress.since_legendary })

    const minted = cards.map(({ cardId, rarity, holo }) => {
      db.prepare('INSERT OR IGNORE INTO card_counters (card_id, holo, next_serial) VALUES (?, ?, 1)').run(cardId, holo ? 1 : 0)
      const { next_serial } = db.prepare('SELECT next_serial FROM card_counters WHERE card_id = ? AND holo = ?').get(cardId, holo ? 1 : 0)
      db.prepare('UPDATE card_counters SET next_serial = next_serial + 1 WHERE card_id = ? AND holo = ?').run(cardId, holo ? 1 : 0)
      db.prepare('INSERT INTO card_instances (telegram_user_id, card_id, holo, serial, source, minted_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        telegramUserId,
        cardId,
        holo ? 1 : 0,
        next_serial,
        `pack:${pack.type}`,
        now,
      )
      return { cardId, rarity, holo, serial: next_serial }
    })

    db.prepare('UPDATE packs SET opened_at = ? WHERE id = ?').run(now, pack.id)
    db.prepare('UPDATE pack_progress SET since_epic = ?, since_legendary = ? WHERE telegram_user_id = ?').run(pity.sinceEpic, pity.sinceLegendary, telegramUserId)
    db.exec('COMMIT')
    return { packType: pack.type, cards: minted }
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/** Everything the user owns: one row per instance (client groups by card). */
export function getCollection(telegramUserId) {
  return db.prepare('SELECT card_id, holo, serial, minted_at FROM card_instances WHERE telegram_user_id = ? ORDER BY id').all(telegramUserId)
}

export function recordPurchase(telegramUserId, item) {
  db.prepare('INSERT INTO purchases (telegram_user_id, item, created_at) VALUES (?, ?, ?)').run(telegramUserId, item, Date.now())
}

/**
 * Atomically returns unclaimed purchases for a user and marks them claimed, so a retried
 * or concurrent request can never grant the same purchase twice.
 */
export function claimPurchases(telegramUserId) {
  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    const rows = db.prepare('SELECT id, item FROM purchases WHERE telegram_user_id = ? AND claimed_at IS NULL').all(telegramUserId)
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id)
      db.prepare(`UPDATE purchases SET claimed_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`).run(now, ...ids)
    }
    db.exec('COMMIT')
    return rows.map((r) => ({ item: r.item }))
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
