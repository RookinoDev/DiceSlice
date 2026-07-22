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

// Sprint 5 (fix-plan-2026-07-14.docx, item #11): daily-login pack days (10/20/30 of the 30-day
// cycle - see TelegramApp's DailyRewardTable.ts/BalanceConfig.dailyPackDays). last_streak_granted
// is the highest save.dailyStreak value already scanned for pack days, so a re-sync at the same
// streak grants nothing - same idempotency shape as pack_progress.bosses_granted above.
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_pack_progress (
    telegram_user_id INTEGER PRIMARY KEY,
    last_streak_granted INTEGER NOT NULL DEFAULT 0
  )
`)

// --- Cards v2 migration: 6-variant model, boss-quality packs, dust, showcase ---
// (holo INTEGER stays as a legacy column, kept in sync for any stale clients; the
// variant TEXT column is the source of truth from here on.)
function hasColumn(table, column) {
  return db.prepare(`SELECT 1 AS x FROM pragma_table_info('${table}') WHERE name = ?`).get(column) !== undefined
}

if (!hasColumn('card_instances', 'variant')) {
  db.exec(`
    ALTER TABLE card_instances ADD COLUMN variant TEXT NOT NULL DEFAULT 'standard';
    UPDATE card_instances SET variant = 'holo' WHERE holo = 1;
    DROP INDEX IF EXISTS ux_card_mint;
  `)
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS ux_card_mint_variant ON card_instances(card_id, variant, serial);
  CREATE TABLE IF NOT EXISTS card_counters_v (
    card_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    next_serial INTEGER NOT NULL,
    PRIMARY KEY (card_id, variant)
  )
`)
// One-time carry-over of serial counters from the holo-boolean era.
db.exec(`
  INSERT OR IGNORE INTO card_counters_v (card_id, variant, next_serial)
  SELECT card_id, CASE holo WHEN 1 THEN 'holo' ELSE 'standard' END, next_serial FROM card_counters
`)
if (!hasColumn('packs', 'quality')) db.exec(`ALTER TABLE packs ADD COLUMN quality REAL NOT NULL DEFAULT 0`)
if (!hasColumn('pack_progress', 'dust')) db.exec(`ALTER TABLE pack_progress ADD COLUMN dust INTEGER NOT NULL DEFAULT 0`)
if (!hasColumn('profiles', 'showcase')) db.exec(`ALTER TABLE profiles ADD COLUMN showcase TEXT`)

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
      `SELECT p.telegram_user_id, p.first_name, p.username, p.photo_url, p.first_synced_at, p.showcase, s.save_json
       FROM profiles p LEFT JOIN saves s ON s.telegram_user_id = p.telegram_user_id
       WHERE p.telegram_user_id = ?`,
    )
    .get(telegramUserId)
  return row ?? null
}

// Sort keys a leaderboard request may ask for, mapped to a SQL expression pulled straight out
// of the existing saves.save_json blob via SQLite's json_extract - no schema migration, since
// profiles/saves are already both keyed by telegram_user_id. The caller's sortBy string is
// looked up here, NEVER interpolated directly into SQL (an unknown key yields undefined, and
// getLeaderboard returns [] rather than building a query at all - see below). Deliberately
// excludes relics/stardust: both are BigNumberData (mantissa+exponent), and comparing raw
// mantissas would sort wrong (mantissa=1,exponent=10 is bigger than mantissa=99,exponent=1) -
// only plain-integer stats are safe to ORDER BY directly like this.
const LEADERBOARD_SORT_COLUMNS = {
  deepestStage: `COALESCE(json_extract(s.save_json, '$.stats.deepestStage'), json_extract(s.save_json, '$.highestStage'), 0)`,
  bossesDefeated: `COALESCE(json_extract(s.save_json, '$.stats.bossesDefeated'), 0)`,
  prestigeCount: `COALESCE(json_extract(s.save_json, '$.stats.prestigeCount'), 0)`,
  deepestBossCleared: `COALESCE(json_extract(s.save_json, '$.stats.deepestBossCleared'), 0)`,
}

/** Top-`limit` public leaderboard ranked by one plain-integer stat. Users who never synced a
 *  save are excluded via the INNER JOIN (nothing to rank them by). Returns [] for an unknown
 *  sortBy - never throws, never touches SQL for it. */
export function getLeaderboard(sortBy, limit = 50) {
  const column = LEADERBOARD_SORT_COLUMNS[sortBy]
  if (!column) return []
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 50, 100))
  return db
    .prepare(
      `SELECT p.telegram_user_id AS telegramUserId, p.first_name AS firstName, p.username, p.photo_url AS photoUrl, ${column} AS value
       FROM profiles p JOIN saves s ON s.telegram_user_id = p.telegram_user_id
       ORDER BY value DESC LIMIT ?`,
    )
    .all(cappedLimit)
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
import { CARD_POOL, craftCost, packQualityForStage, packTypeForBossStage, refineValue, rollPack, VARIANT_ORDER } from './cards.mjs'

const POOL_BY_ID = new Map(CARD_POOL.map((c) => [c.id, c]))

/** Mint one instance inside an open transaction: assigns the next serial for (card, variant). */
function mintInstance(telegramUserId, cardId, variant, source, now) {
  db.prepare('INSERT OR IGNORE INTO card_counters_v (card_id, variant, next_serial) VALUES (?, ?, 1)').run(cardId, variant)
  const { next_serial } = db.prepare('SELECT next_serial FROM card_counters_v WHERE card_id = ? AND variant = ?').get(cardId, variant)
  db.prepare('UPDATE card_counters_v SET next_serial = next_serial + 1 WHERE card_id = ? AND variant = ?').run(cardId, variant)
  db.prepare('INSERT INTO card_instances (telegram_user_id, card_id, holo, variant, serial, source, minted_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    telegramUserId,
    cardId,
    variant === 'holo' ? 1 : 0,
    variant,
    next_serial,
    source,
    now,
  )
  return next_serial
}

/** Cap on packs granted per single save sync - a sanity brake, not a balance knob. */
const MAX_PACKS_PER_SYNC = 20
/** Mirrors TelegramApp's defaultBalanceConfig.bossStageInterval - small, rarely-changing
 * value, kept in sync by hand same as this file already does for DAILY_PACK_DAYS below. */
const BOSS_STAGE_INTERVAL = 5

/**
 * Grants packs for boss kills revealed by a cloud-save sync: the delta between how many
 * DISTINCT boss stages the save has ever cleared and what we've granted for already - one
 * pack per boss, ever. Keyed off stats.deepestBossCleared (a lifetime high-water mark that
 * only advances on an actual clear and never resets on prestige - see TelegramApp's
 * LifetimeStats.ts) rather than a raw kill count, so replaying an already-cleared boss stage
 * after a Stellar Ascension no longer re-grants a pack for it. pack_progress.bosses_granted
 * still means "packs granted so far" either way, which is what makes this swap safe for
 * players who already had packs granted under the old raw-count rule: a veteran who never
 * prestige-farmed sees no change (their unique-boss count already equals their raw kill
 * count); one who did sees their next sync compute zero new packs until their genuine
 * unique-boss progress catches back up past what they'd already been granted - never a
 * double grant, never a clawback.
 *
 * Pack type is inferred from the save's deepest stage (recent bosses cluster near it) -
 * unrelated to the dedup rule above, so it still uses raw depth, not unique-boss count.
 * Trust model: client-authoritative progress, server-authoritative grants - see the plan doc.
 */
export function grantPacksFromSave(telegramUserId, save) {
  const deepestBossCleared = Number(save?.stats?.deepestBossCleared)
  if (!Number.isFinite(deepestBossCleared) || deepestBossCleared <= 0) return 0
  const uniqueBossesCleared = Math.floor(deepestBossCleared / BOSS_STAGE_INTERVAL)
  if (uniqueBossesCleared <= 0) return 0
  const deepest = Math.max(Number(save?.stats?.deepestStage) || 1, Number(save?.highestStage) || 1)

  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT OR IGNORE INTO pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    const progress = db.prepare('SELECT bosses_granted FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
    const delta = Math.min(uniqueBossesCleared - progress.bosses_granted, MAX_PACKS_PER_SYNC)
    if (delta <= 0) {
      db.exec('COMMIT')
      return 0
    }
    const type = packTypeForBossStage(deepest)
    const quality = packQualityForStage(deepest)
    const insert = db.prepare('INSERT INTO packs (telegram_user_id, type, created_at, quality) VALUES (?, ?, ?, ?)')
    for (let i = 0; i < delta; i++) insert.run(telegramUserId, type, now, quality)
    db.prepare('UPDATE pack_progress SET bosses_granted = bosses_granted + ? WHERE telegram_user_id = ?').run(delta, telegramUserId)
    db.exec('COMMIT')
    return delta
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

// Mirrors TelegramApp's defaultBalanceConfig.dailyPackDays (src/game/config/BalanceConfig.ts) -
// small, rarely-changing table, kept in sync by hand same as this file already does for
// cardPool.json (see its own header comment): client and server must agree on tiers.
const DAILY_PACK_DAYS = { 10: 'meteor', 20: 'stellar', 30: 'deepsky' }
const DAILY_CYCLE_LENGTH = 30
/** How many streak values a single sync will scan looking for pack days - bounds the loop
 * below against a malformed/huge reported streak; 300 covers 30 real pack-day crossings, far
 * more than any realistically-syncing client would ever need in one call. */
const MAX_DAILY_STREAK_SCAN = 300

function dayInDailyCycle(streak) {
  return ((Math.max(1, streak) - 1) % DAILY_CYCLE_LENGTH) + 1
}

/**
 * Grants card packs for daily-login streak milestones (days 10/20/30, see DAILY_PACK_DAYS)
 * revealed by a cloud-save sync. Tracks the highest streak value already scanned; a reported
 * streak LOWER than that means the run reset (DailyRewardService resets streak to 1 on a missed
 * day) and started fresh, so the floor resets too - each fresh run through day 10/20/30 earns
 * its own pack, same as the daily reward itself is claimable again every cycle. Same
 * client-authoritative-progress/server-authoritative-grant trust model as boss packs.
 */
export function grantDailyPackFromSave(telegramUserId, save) {
  const streak = Math.floor(Number(save?.dailyStreak))
  if (!Number.isFinite(streak) || streak <= 0) return 0

  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT OR IGNORE INTO daily_pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    const row = db.prepare('SELECT last_streak_granted FROM daily_pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
    const floor = streak < row.last_streak_granted ? 0 : row.last_streak_granted
    const scanTo = Math.min(streak, floor + MAX_DAILY_STREAK_SCAN)

    const insert = db.prepare('INSERT INTO packs (telegram_user_id, type, created_at, quality) VALUES (?, ?, ?, ?)')
    let granted = 0
    for (let s = floor + 1; s <= scanTo; s++) {
      const type = DAILY_PACK_DAYS[dayInDailyCycle(s)]
      if (type) {
        insert.run(telegramUserId, type, now, 0)
        granted++
      }
    }
    db.prepare('UPDATE daily_pack_progress SET last_streak_granted = ? WHERE telegram_user_id = ?').run(scanTo, telegramUserId)
    db.exec('COMMIT')
    return granted
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
    const pack = db.prepare('SELECT id, type, quality FROM packs WHERE id = ? AND telegram_user_id = ? AND opened_at IS NULL').get(packId, telegramUserId)
    if (!pack) {
      db.exec('COMMIT')
      return null
    }

    db.prepare('INSERT OR IGNORE INTO pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    const progress = db.prepare('SELECT since_epic, since_legendary FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
    // New-card weighting needs the owned set; boss quality tilts the slot table (see cards.mjs).
    const ownedIds = new Set(db.prepare('SELECT DISTINCT card_id FROM card_instances WHERE telegram_user_id = ?').all(telegramUserId).map((r) => r.card_id))
    const { cards, pity } = rollPack(pack.type, { sinceEpic: progress.since_epic, sinceLegendary: progress.since_legendary }, ownedIds, pack.quality ?? 0)

    const minted = cards.map(({ cardId, rarity, variant }) => {
      const serial = mintInstance(telegramUserId, cardId, variant, `pack:${pack.type}`, now)
      return { cardId, rarity, variant, holo: variant === 'holo', serial, isNew: !ownedIds.has(cardId) }
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
  return db.prepare('SELECT id, card_id, variant, serial, minted_at FROM card_instances WHERE telegram_user_id = ? ORDER BY id').all(telegramUserId)
}

/** The user's Prism Dust balance (duplicate-refine currency). */
export function getDust(telegramUserId) {
  const row = db.prepare('SELECT dust FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
  return row ? row.dust : 0
}

/**
 * Refines (destroys) owned duplicate instances into dust. Duplicates only: an instance is
 * refinable only while the user owns MORE THAN ONE instance of that base card, and the last
 * remaining copy can never be refined - refining can't punch a hole in the collection.
 * Returns { refined, dust } or null when any id is invalid/not refinable (all-or-nothing).
 */
export function refineInstances(telegramUserId, instanceIds) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0 || instanceIds.length > 200) return null
  db.exec('BEGIN IMMEDIATE')
  try {
    const rows = instanceIds.map((id) => db.prepare('SELECT id, card_id, variant FROM card_instances WHERE id = ? AND telegram_user_id = ?').get(id, telegramUserId))
    if (rows.some((r) => r === undefined) || new Set(instanceIds).size !== instanceIds.length) {
      db.exec('ROLLBACK')
      return null
    }
    // Per base card: refining N instances requires owning at least N+1 of it.
    const perCard = new Map()
    for (const r of rows) perCard.set(r.card_id, (perCard.get(r.card_id) ?? 0) + 1)
    for (const [cardId, n] of perCard) {
      const { c } = db.prepare('SELECT COUNT(*) AS c FROM card_instances WHERE telegram_user_id = ? AND card_id = ?').get(telegramUserId, cardId)
      if (c <= n) {
        db.exec('ROLLBACK')
        return null
      }
    }
    let gained = 0
    for (const r of rows) {
      const rarity = POOL_BY_ID.get(r.card_id)?.rarity ?? 'common'
      gained += refineValue(rarity, r.variant)
      db.prepare('DELETE FROM card_instances WHERE id = ?').run(r.id)
    }
    db.prepare('INSERT OR IGNORE INTO pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    db.prepare('UPDATE pack_progress SET dust = dust + ? WHERE telegram_user_id = ?').run(gained, telegramUserId)
    const dust = db.prepare('SELECT dust FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId).dust
    db.exec('COMMIT')
    return { refined: rows.length, gained, dust }
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/**
 * Crafts a chosen card (any variant) for dust - deterministic bad-luck protection plus the
 * duplicate-progression path to special variants. Returns the minted card or null
 * (unknown card / bad variant / insufficient dust).
 */
export function craftCard(telegramUserId, cardId, variant) {
  const def = POOL_BY_ID.get(cardId)
  if (!def || !VARIANT_ORDER.includes(variant)) return null
  const cost = craftCost(def.rarity, variant)
  const now = Date.now()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('INSERT OR IGNORE INTO pack_progress (telegram_user_id) VALUES (?)').run(telegramUserId)
    const { dust } = db.prepare('SELECT dust FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId)
    if (dust < cost) {
      db.exec('ROLLBACK')
      return null
    }
    db.prepare('UPDATE pack_progress SET dust = dust - ? WHERE telegram_user_id = ?').run(cost, telegramUserId)
    const serial = mintInstance(telegramUserId, cardId, variant, 'craft', now)
    const remaining = db.prepare('SELECT dust FROM pack_progress WHERE telegram_user_id = ?').get(telegramUserId).dust
    db.exec('COMMIT')
    return { cardId, rarity: def.rarity, variant, serial, cost, dust: remaining }
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

const SHOWCASE_MAX = 8

/**
 * Saves the profile showcase: an ordered list of up to 8 owned (cardId, variant) pairs.
 * Returns false when any entry isn't owned in that exact variant.
 */
export function setShowcase(telegramUserId, cards) {
  if (!Array.isArray(cards) || cards.length > SHOWCASE_MAX) return false
  const owned = db.prepare('SELECT 1 AS x FROM card_instances WHERE telegram_user_id = ? AND card_id = ? AND variant = ? LIMIT 1')
  for (const c of cards) {
    if (!c || typeof c.cardId !== 'string' || !VARIANT_ORDER.includes(c.variant)) return false
    if (owned.get(telegramUserId, c.cardId, c.variant) === undefined) return false
  }
  const json = JSON.stringify(cards.map((c) => ({ cardId: c.cardId, variant: c.variant })))
  const now = Date.now()
  db.prepare(`
    INSERT INTO profiles (telegram_user_id, showcase, first_synced_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET showcase = excluded.showcase, updated_at = excluded.updated_at
  `).run(telegramUserId, json, now, now)
  return true
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
