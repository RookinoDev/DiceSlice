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
