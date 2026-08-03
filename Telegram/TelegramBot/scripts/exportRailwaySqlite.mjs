// Phase 3 (see the migration plan): reads the LIVE Railway SQLite file (same schema db.mjs still
// defines today) and dumps it into one JSON payload shaped for adminImport.mjs to replay - one
// entry per (telegram_user_id) grouping everything that becomes PlayerDO storage, plus the two
// flat arrays (referrals, card counters) that become D1 rows directly. Read-only: never touches
// the source file's contents, never deletes/mutates the live database.
//
// Usage: node scripts/exportRailwaySqlite.mjs <path-to-purchases.db> <output.json>
// The source path is whatever the live Railway Volume's SQLite file is called locally once
// pulled off the volume (see the plan's Phase 3 for how that pull itself happens - outside this
// script's scope, since it needs the user's own Railway access).
import { DatabaseSync } from 'node:sqlite'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function exportRailwaySqlite(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true })

  const referrals = db.prepare('SELECT referred_user_id, referrer_user_id, created_at FROM referrals').all()

  // card_counters_v is the current source of truth (variant-keyed) - the legacy holo-boolean
  // card_counters table predates it and was already a one-time migration input, not read again.
  const cardCounters = db.prepare('SELECT card_id, variant, next_serial FROM card_counters_v').all()

  const players = {}
  const ensurePlayer = (id) => {
    if (!players[id]) {
      players[id] = { profile: null, save: null, purchases: [], cardInstances: [], packs: [], packProgress: null, dailyPackProgress: null }
    }
    return players[id]
  }

  for (const row of db.prepare('SELECT * FROM profiles').all()) {
    ensurePlayer(row.telegram_user_id).profile = row
  }
  for (const row of db.prepare('SELECT telegram_user_id, save_json, updated_at FROM saves').all()) {
    ensurePlayer(row.telegram_user_id).save = { saveJson: row.save_json, updatedAt: row.updated_at }
  }
  for (const row of db.prepare('SELECT telegram_user_id, item, created_at, claimed_at FROM purchases').all()) {
    ensurePlayer(row.telegram_user_id).purchases.push(row)
  }
  // variant is the source of truth (see db.mjs's cards v2 migration comment) - holo is dropped,
  // same as playerDurableObject.mjs's fresh schema never carrying it forward.
  for (const row of db.prepare('SELECT telegram_user_id, card_id, variant, serial, source, minted_at FROM card_instances').all()) {
    ensurePlayer(row.telegram_user_id).cardInstances.push(row)
  }
  for (const row of db.prepare('SELECT telegram_user_id, type, quality, created_at, opened_at FROM packs').all()) {
    ensurePlayer(row.telegram_user_id).packs.push(row)
  }
  for (const row of db.prepare('SELECT telegram_user_id, bosses_granted, since_epic, since_legendary, dust FROM pack_progress').all()) {
    ensurePlayer(row.telegram_user_id).packProgress = row
  }
  for (const row of db.prepare('SELECT telegram_user_id, last_streak_granted FROM daily_pack_progress').all()) {
    ensurePlayer(row.telegram_user_id).dailyPackProgress = row
  }

  db.close()
  return { referrals, cardCounters, players }
}

// Only run the CLI when invoked directly (`node exportRailwaySqlite.mjs ...`), not when imported
// (exportRailwaySqlite.test.mjs imports exportRailwaySqlite() itself, against a synthetic file).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , dbPath, outPath] = process.argv
  if (!dbPath || !outPath) {
    console.error('Usage: node scripts/exportRailwaySqlite.mjs <path-to-purchases.db> <output.json>')
    process.exit(1)
  }

  const payload = exportRailwaySqlite(dbPath)
  writeFileSync(outPath, JSON.stringify(payload))
  console.log(`Exported ${Object.keys(payload.players).length} players, ${payload.referrals.length} referrals, ${payload.cardCounters.length} card counters -> ${outPath}`)
}

export { exportRailwaySqlite }
