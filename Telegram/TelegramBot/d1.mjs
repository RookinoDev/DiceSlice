// Shared D1 helpers - everything genuinely cross-user (see migrations/0001_init.sql for why:
// the leaderboard/re-engagement index, the global card serial ticker, and referrals). Imported
// by both worker.mjs (referral recording from bot.command('start'), the leaderboard endpoint,
// the Cron re-engagement scan) and playerDurableObject.mjs (serial allocation inside
// openPack/craftCard, pushing this user's leaderboard-relevant stats after a save sync).

/**
 * Atomically allocates one serial per request via INSERT..ON CONFLICT DO UPDATE..RETURNING -
 * safe under concurrent callers because D1 is single-writer per database, and safe for two
 * requests asking for the SAME (cardId, variant) in one call (a pack can roll two copies of a
 * card never owned before - see cards.mjs's NEW_CARD_REROLLS comment) because batch() runs as
 * one SQL transaction: each statement in the batch sees the row state the previous one left,
 * same as db.mjs's old mintInstance loop did inside its own BEGIN IMMEDIATE.
 * requests: [{ cardId, variant }, ...] (order preserved in the returned serials array).
 */
export async function allocateSerials(env, requests) {
  if (requests.length === 0) return []
  const stmt = env.DB.prepare(
    `INSERT INTO card_counters_v (card_id, variant, next_serial) VALUES (?, ?, 2)
       ON CONFLICT(card_id, variant) DO UPDATE SET next_serial = next_serial + 1
       RETURNING next_serial - 1 AS allocated_serial`,
  )
  const results = await env.DB.batch(requests.map((r) => stmt.bind(r.cardId, r.variant)))
  return results.map((r) => r.results[0].allocated_serial)
}

/** Upsert the player's public identity into the leaderboard index - mirrors db.mjs's old
 *  upsertProfile, but only ever touches these 3 columns (never clobbers stats/notification
 *  fields written by the functions below). */
export async function upsertProfileIdentity(env, telegramUserId, { firstName, username, photoUrl }) {
  await env.DB.prepare(
    `INSERT INTO player_index (telegram_user_id, first_name, username, photo_url) VALUES (?, ?, ?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         first_name = excluded.first_name, username = excluded.username, photo_url = excluded.photo_url`,
  )
    .bind(telegramUserId, firstName ?? null, username ?? null, photoUrl ?? null)
    .run()
}

/** Refreshes this user's leaderboard-relevant stats after a save sync - called from
 *  playerDurableObject.mjs's putSave. Replaces the old getLeaderboard's json_extract-at-query-time
 *  approach with extract-at-write-time, since D1 can no longer join against a saves table it
 *  doesn't own (the save blob itself lives in the user's own PlayerDO now, not D1). */
export async function syncLeaderboardStats(env, telegramUserId, { deepestStage, bossesDefeated, prestigeCount, deepestBossCleared }) {
  await env.DB.prepare(
    `INSERT INTO player_index (telegram_user_id, deepest_stage, bosses_defeated, prestige_count, deepest_boss_cleared, saves_updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET
         deepest_stage = excluded.deepest_stage, bosses_defeated = excluded.bosses_defeated,
         prestige_count = excluded.prestige_count, deepest_boss_cleared = excluded.deepest_boss_cleared,
         saves_updated_at = excluded.saves_updated_at`,
  )
    .bind(telegramUserId, deepestStage, bossesDefeated, prestigeCount, deepestBossCleared, Date.now())
    .run()
}

/** Mirrors db.mjs's old setNotificationsEnabled - only ever touches this one column. */
export async function setNotificationsEnabled(env, telegramUserId, enabled) {
  await env.DB.prepare(
    `INSERT INTO player_index (telegram_user_id, notifications_enabled) VALUES (?, ?)
       ON CONFLICT(telegram_user_id) DO UPDATE SET notifications_enabled = excluded.notifications_enabled`,
  )
    .bind(telegramUserId, enabled ? 1 : 0)
    .run()
}

/** Mirrors db.mjs's old markNotified - a plain UPDATE, safe because every caller comes from
 *  getUsersDueForReengagement, whose own query already requires a synced (saves_updated_at
 *  NOT NULL) row to exist. */
export async function markNotified(env, telegramUserId) {
  await env.DB.prepare('UPDATE player_index SET last_notified_at = ? WHERE telegram_user_id = ?').bind(Date.now(), telegramUserId).run()
}

// Same sort keys/columns db.mjs's old LEADERBOARD_SORT_COLUMNS exposed, now plain columns
// instead of json_extract expressions (see syncLeaderboardStats above for why). The caller's
// sortBy string is looked up here, never interpolated into SQL - an unknown key yields
// undefined and getLeaderboard returns [] without building a query at all.
const LEADERBOARD_SORT_COLUMNS = {
  deepestStage: 'deepest_stage',
  bossesDefeated: 'bosses_defeated',
  prestigeCount: 'prestige_count',
  deepestBossCleared: 'deepest_boss_cleared',
}

/** Top-`limit` public leaderboard ranked by one stat. Users who never synced a save are
 *  excluded via saves_updated_at IS NOT NULL - same exclusion db.mjs's old INNER JOIN on saves
 *  gave for free. Returns [] for an unknown sortBy, same as before. */
export async function getLeaderboard(env, sortBy, limit = 50) {
  const column = LEADERBOARD_SORT_COLUMNS[sortBy]
  if (!column) return []
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 50, 100))
  const { results } = await env.DB.prepare(
    `SELECT telegram_user_id AS telegramUserId, first_name AS firstName, username, photo_url AS photoUrl, ${column} AS value
       FROM player_index WHERE saves_updated_at IS NOT NULL ORDER BY value DESC LIMIT ?`,
  )
    .bind(cappedLimit)
    .all()
  return results
}

/** Users due for a re-engagement reminder - same conditions as db.mjs's old
 *  getUsersDueForReengagement (notifications on, idle past idleMs, not reminded within
 *  cooldownMs), against player_index instead of a profiles/saves join. */
export async function getUsersDueForReengagement(env, idleMs, cooldownMs) {
  const now = Date.now()
  const { results } = await env.DB.prepare(
    `SELECT telegram_user_id AS telegramUserId FROM player_index
       WHERE notifications_enabled = 1 AND saves_updated_at IS NOT NULL AND saves_updated_at < ?
         AND (last_notified_at IS NULL OR last_notified_at < ?)`,
  )
    .bind(now - idleMs, now - cooldownMs)
    .all()
  return results.map((r) => r.telegramUserId)
}

/** Mirrors db.mjs's old recordReferral: first touch wins (referred_user_id is the PRIMARY KEY),
 *  self-referral is a no-op. Returns whether this call actually recorded it. */
export async function recordReferral(env, referredUserId, referrerUserId) {
  if (referredUserId === referrerUserId) return false
  const result = await env.DB.prepare('INSERT OR IGNORE INTO referrals (referred_user_id, referrer_user_id, created_at) VALUES (?, ?, ?)')
    .bind(referredUserId, referrerUserId, Date.now())
    .run()
  return result.meta.changes > 0
}

/** How many people `telegramUserId` has referred, ever. */
export async function getReferralCount(env, telegramUserId) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM referrals WHERE referrer_user_id = ?').bind(telegramUserId).first()
  return row.c
}

// -- Analytics (see migrations/0002_events.sql) --

/** Records one lightweight analytics event. Never throws into the caller's request path -
 *  analytics failing must never break gameplay/payments, so a write failure here just logs. */
export async function recordEvent(env, { type, telegramUserId, item = null, valueStars = null }) {
  try {
    await env.DB.prepare('INSERT INTO events (type, telegram_user_id, item, value_stars, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(type, telegramUserId, item, valueStars, Date.now())
      .run()
  } catch (e) {
    console.warn('[analytics] recordEvent failed:', e.message)
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Everything /api/admin/stats needs in one call: revenue, DAU/WAU (distinct users with a
 *  'session' event in the window), and invoice->purchase conversion per SKU. 'session' events
 *  come from every save sync (see playerDurableObject.mjs's syncSave), which fires at least once
 *  per app open - a reasonable session proxy without adding a dedicated client-side ping. */
export async function getAdminStats(env) {
  const now = Date.now()
  const [revenue, revenueByItem, funnelByItem, dau, wau, totalPlayers] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS purchases, COALESCE(SUM(value_stars), 0) AS stars FROM events WHERE type = 'purchase_completed'`).first(),
    env.DB.prepare(
      `SELECT item, COUNT(*) AS purchases, COALESCE(SUM(value_stars), 0) AS stars FROM events
         WHERE type = 'purchase_completed' GROUP BY item ORDER BY stars DESC`,
    ).all(),
    env.DB.prepare(
      `SELECT item,
         SUM(CASE WHEN type = 'invoice_created' THEN 1 ELSE 0 END) AS invoices,
         SUM(CASE WHEN type = 'purchase_completed' THEN 1 ELSE 0 END) AS purchases
       FROM events WHERE type IN ('invoice_created', 'purchase_completed') GROUP BY item`,
    ).all(),
    env.DB.prepare(`SELECT COUNT(DISTINCT telegram_user_id) AS c FROM events WHERE type = 'session' AND created_at > ?`).bind(now - DAY_MS).first(),
    env.DB.prepare(`SELECT COUNT(DISTINCT telegram_user_id) AS c FROM events WHERE type = 'session' AND created_at > ?`)
      .bind(now - 7 * DAY_MS)
      .first(),
    env.DB.prepare('SELECT COUNT(*) AS c FROM player_index').first(),
  ])
  return {
    totalRevenueStars: revenue.stars,
    totalPurchases: revenue.purchases,
    revenueByItem: revenueByItem.results,
    conversionByItem: funnelByItem.results.map((r) => ({ ...r, conversionRate: r.invoices > 0 ? r.purchases / r.invoices : null })),
    dailyActiveUsers: dau.c,
    weeklyActiveUsers: wau.c,
    totalPlayers: totalPlayers.c,
    generatedAt: now,
  }
}
