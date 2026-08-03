// One PlayerDO instance per telegram_user_id (routed by worker.mjs via
// env.PLAYER_DO.idFromName(String(telegramUserId))) - owns everything that was per-user in the
// old db.mjs: saves, packs, pity counters, dust, purchases, showcase, gem sockets, and the
// one-time-invoice reservation server.mjs used to keep in an in-memory Map. A DO instance is
// single-threaded (no other request to the SAME instance runs while one is in progress) and its
// ctx.storage.sql API is synchronous and prepared-statement-shaped, close enough to db.mjs's old
// node:sqlite usage that most of its transaction bodies port with mechanical changes - see each
// method below for how it maps to its db.mjs namesake.
//
// What's deliberately NOT here (moved to D1 instead, see d1.mjs + migrations/0001_init.sql):
// card_counters_v (must be unique across every player, not per-user - a per-DO counter would
// let two users opening packs at the same moment mint duplicate serials for the same card), the
// leaderboard/re-engagement index (needs cross-user queries a per-user DO can't do), and
// referrals (its one write is already a single atomic statement, no DO needed).
//
// Talks to the outside world over plain fetch(request), not native DO RPC (stub.methodName()) -
// verified during development that RPC-style calls fail unexplained ("internal error") against
// this project's local wrangler dev/workerd setup, while classic fetch-based DO access works
// reliably (including under @cloudflare/vitest-pool-workers, the real test harness for this
// file). getPlayerStub()/callPlayerDO() below are the only calling convention worker.mjs needs.
import { craftCost, PACK_TYPES, packQualityForStage, packTypeForBossStage, refineValue, rollPack, VARIANT_ORDER, CARD_POOL } from './cards.mjs'
import { allocateSerials, recordEvent, rewardReferrerIfDue, syncLeaderboardStats, upsertProfileIdentity } from './d1.mjs'

const POOL_BY_ID = new Map(CARD_POOL.map((c) => [c.id, c]))

const SHOWCASE_MAX = 8
const GEM_SOCKETS_MAX = 79 // matches the talent tree's total node count
const MAX_PACKS_PER_SYNC = 20 // sanity brake, not a balance knob
const BOSS_STAGE_INTERVAL = 5 // mirrors TelegramApp's defaultBalanceConfig.bossStageInterval
const DAILY_PACK_DAYS = { 10: 'meteor', 20: 'stellar', 30: 'deepsky' } // mirrors BalanceConfig.dailyPackDays
const DAILY_CYCLE_LENGTH = 30
const MAX_DAILY_STREAK_SCAN = 300
const BUY_PACK_PREFIX = 'buy_pack_'
const STARTER_PACK_ITEM = 'starter_pack'
const STARTER_PACK_TYPE = 'stellar'

function dayInDailyCycle(streak) {
  return ((Math.max(1, streak) - 1) % DAILY_CYCLE_LENGTH) + 1
}

function packTypeForPurchaseItem(item) {
  if (item === STARTER_PACK_ITEM) return STARTER_PACK_TYPE
  if (item.startsWith(BUY_PACK_PREFIX)) return item.slice(BUY_PACK_PREFIX.length)
  return null
}

export class PlayerDO {
  constructor(state, env) {
    this.ctx = state
    this.sql = state.storage.sql
    this.env = env
    this._initSchema()
  }

  _initSchema() {
    // Singleton tables (profile/saves/pack_progress/daily_pack_progress) use a CHECK-constrained
    // id=1 row instead of a telegram_user_id key - there's exactly one of each per DO, and which
    // user this is is already implicit in which DO instance this is.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1), first_name TEXT, username TEXT, photo_url TEXT,
      first_synced_at INTEGER, updated_at INTEGER, showcase TEXT, gem_sockets TEXT
    )`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY CHECK (id = 1), save_json TEXT, updated_at INTEGER
    )`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, created_at INTEGER NOT NULL, claimed_at INTEGER
    )`)
    // No `holo` legacy column (see cards.mjs migration history in the old db.mjs) - this is a
    // fresh schema, no stale clients reading it, and getCollection() never exposed it anyway.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS card_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT, card_id TEXT NOT NULL, variant TEXT NOT NULL,
      serial INTEGER NOT NULL, source TEXT NOT NULL, minted_at INTEGER NOT NULL
    )`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, quality REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, opened_at INTEGER
    )`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pack_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1), bosses_granted INTEGER NOT NULL DEFAULT 0,
      since_epic INTEGER NOT NULL DEFAULT 0, since_legendary INTEGER NOT NULL DEFAULT 0, dust INTEGER NOT NULL DEFAULT 0
    )`)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS daily_pack_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1), last_streak_granted INTEGER NOT NULL DEFAULT 0
    )`)
    // Replaces server.mjs's in-memory pendingOneTimeInvoices Map - a DO evicts from memory far
    // more often than the old always-on Railway process ever restarted, which would reopen the
    // exact double-invoice race that Map existed to close. Needs real storage, not DO memory.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pending_invoices (item_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)`)
  }

  _insertCardInstance(cardId, variant, serial, source, now) {
    this.sql.exec('INSERT INTO card_instances (card_id, variant, serial, source, minted_at) VALUES (?, ?, ?, ?, ?)', cardId, variant, serial, source, now)
  }

  // -- Profile / saves --

  /** Combines db.mjs's old putSave + upsertProfile + the leaderboard-index push (new - the old
   *  system derived leaderboard values from the save JSON at query time via D1... no, via
   *  json_extract against a shared saves table; now the save blob lives here, in this DO, so the
   *  4 sortable stats get pushed to D1 at write time instead) + grantPacksFromSave +
   *  grantDailyPackFromSave + listUnopenedPacks, mirroring the old /api/save handler's full
   *  sequence in one DO call instead of five separate db.mjs calls. Needs telegramUserId only
   *  for the D1 push (this DO's own storage never needs to know its own key). */
  async syncSave(telegramUserId, saveJson, profileFields) {
    const save = JSON.parse(saveJson)
    const now = Date.now()
    // Referral reward trigger (see rewardReferrerIfDue's own comment for why "first sync" and
    // not "/start") - must read before the profile INSERT below creates the row.
    const isFirstSync = this.sql.exec('SELECT 1 AS x FROM profile WHERE id = 1').toArray().length === 0
    this.sql.exec(
      `INSERT INTO saves (id, save_json, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at`,
      saveJson,
      now,
    )
    this.sql.exec(
      `INSERT INTO profile (id, first_name, username, photo_url, first_synced_at, updated_at) VALUES (1, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username,
           photo_url = excluded.photo_url, updated_at = excluded.updated_at`,
      profileFields.firstName ?? null,
      profileFields.username ?? null,
      profileFields.photoUrl ?? null,
      now,
      now,
    )

    // Same COALESCE-shaped fallback db.mjs's old deepestStage sort column used: prefer
    // stats.deepestStage, fall back to highestStage, then 0.
    const deepestStage = save?.stats?.deepestStage ?? save?.highestStage ?? 0
    await Promise.all([
      upsertProfileIdentity(this.env, telegramUserId, profileFields),
      syncLeaderboardStats(this.env, telegramUserId, {
        deepestStage,
        bossesDefeated: save?.stats?.bossesDefeated ?? 0,
        prestigeCount: save?.stats?.prestigeCount ?? 0,
        deepestBossCleared: save?.stats?.deepestBossCleared ?? 0,
      }),
      // DAU/WAU proxy - a save sync fires at least once per app open (see useGameSession.ts),
      // so this needs no dedicated client-side session ping.
      recordEvent(this.env, { type: 'session', telegramUserId }),
    ])

    if (isFirstSync) {
      const referrerId = await rewardReferrerIfDue(this.env, telegramUserId)
      if (referrerId) await callPlayerDO(this.env, referrerId, 'record-purchase', { item: 'referral_reward' })
    }

    const grantedBoss = this.grantPacksFromSave(save)
    const grantedDaily = this.grantDailyPackFromSave(save)
    const pendingPacks = this.listUnopenedPacks().length
    return { grantedBoss, grantedDaily, pendingPacks }
  }

  getSave() {
    const row = this.sql.exec('SELECT save_json FROM saves WHERE id = 1').toArray()[0]
    return row ? row.save_json : null
  }

  /** Everything the public /api/profile endpoint needs in one call: identity, first_synced_at,
   *  showcase, and the raw save JSON (worker.mjs extracts highestStage/relics/dailyStreak/stats
   *  from it, mirroring the old publicProfilePayload - that's presentation shaping, not data
   *  access, so it lives in worker.mjs now, not here). */
  getProfile() {
    const row = this.sql.exec('SELECT first_name, username, photo_url, first_synced_at, showcase FROM profile WHERE id = 1').toArray()[0]
    if (!row) return null
    const save = this.sql.exec('SELECT save_json FROM saves WHERE id = 1').toArray()[0]
    return { ...row, save_json: save ? save.save_json : null }
  }

  // -- Card packs --

  /** Grants packs for boss kills revealed by a save sync - see db.mjs's old grantPacksFromSave
   *  for the full one-pack-per-boss-ever reasoning (unchanged here, purely a storage-API port:
   *  no BEGIN IMMEDIATE/COMMIT needed since this whole method runs as one synchronous block on
   *  a single-threaded DO, so nothing else can interleave with it). */
  grantPacksFromSave(save) {
    const deepestBossCleared = Number(save?.stats?.deepestBossCleared)
    if (!Number.isFinite(deepestBossCleared) || deepestBossCleared <= 0) return 0
    const uniqueBossesCleared = Math.floor(deepestBossCleared / BOSS_STAGE_INTERVAL)
    if (uniqueBossesCleared <= 0) return 0
    const deepest = Math.max(Number(save?.stats?.deepestStage) || 1, Number(save?.highestStage) || 1)

    const now = Date.now()
    this.sql.exec('INSERT OR IGNORE INTO pack_progress (id) VALUES (1)')
    const progress = this.sql.exec('SELECT bosses_granted FROM pack_progress WHERE id = 1').toArray()[0]
    const delta = Math.min(uniqueBossesCleared - progress.bosses_granted, MAX_PACKS_PER_SYNC)
    if (delta <= 0) return 0
    const type = packTypeForBossStage(deepest)
    const quality = packQualityForStage(deepest)
    for (let i = 0; i < delta; i++) this.sql.exec('INSERT INTO packs (type, created_at, quality) VALUES (?, ?, ?)', type, now, quality)
    this.sql.exec('UPDATE pack_progress SET bosses_granted = bosses_granted + ? WHERE id = 1', delta)
    return delta
  }

  /** Grants packs for daily-login streak milestones - see db.mjs's old grantDailyPackFromSave. */
  grantDailyPackFromSave(save) {
    const streak = Math.floor(Number(save?.dailyStreak))
    if (!Number.isFinite(streak) || streak <= 0) return 0

    const now = Date.now()
    this.sql.exec('INSERT OR IGNORE INTO daily_pack_progress (id) VALUES (1)')
    const row = this.sql.exec('SELECT last_streak_granted FROM daily_pack_progress WHERE id = 1').toArray()[0]
    const floor = streak < row.last_streak_granted ? 0 : row.last_streak_granted
    const scanTo = Math.min(streak, floor + MAX_DAILY_STREAK_SCAN)

    let granted = 0
    for (let s = floor + 1; s <= scanTo; s++) {
      const type = DAILY_PACK_DAYS[dayInDailyCycle(s)]
      if (type) {
        this.sql.exec('INSERT INTO packs (type, created_at, quality) VALUES (?, ?, 0)', type, now)
        granted++
      }
    }
    this.sql.exec('UPDATE daily_pack_progress SET last_streak_granted = ? WHERE id = 1', scanTo)
    return granted
  }

  listUnopenedPacks() {
    return this.sql.exec('SELECT id, type, created_at FROM packs WHERE opened_at IS NULL ORDER BY id').toArray()
  }

  /**
   * Opens a pack: verifies ownership/unopened state, rolls contents, mints serial-numbered
   * instances, marks the pack opened. Wrapped in blockConcurrencyWhile - without it, two
   * concurrent opens of the SAME pack could both pass the `opened_at IS NULL` check (both read
   * before either writes), both await the D1 serial allocation, and both mint cards for a pack
   * that should only ever open once. blockConcurrencyWhile makes the whole read-await-write
   * sequence exclusive: no other request to this DO instance runs any of its own JS until this
   * one finishes, closing that window entirely (this is the one place in this file where an
   * await sits between a read and the write it gates - everywhere else, either there's no await
   * at all, or the read the write depends on happens AFTER the only await, in an uninterrupted
   * synchronous tail that can't be interleaved with another call's tail on a single-threaded DO).
   */
  async openPack(packId) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now()
      const pack = this.sql.exec('SELECT id, type, quality FROM packs WHERE id = ? AND opened_at IS NULL', packId).toArray()[0]
      if (!pack) return null

      this.sql.exec('INSERT OR IGNORE INTO pack_progress (id) VALUES (1)')
      const progress = this.sql.exec('SELECT since_epic, since_legendary FROM pack_progress WHERE id = 1').toArray()[0]
      const ownedIds = new Set(this.sql.exec('SELECT DISTINCT card_id FROM card_instances').toArray().map((r) => r.card_id))
      const { cards, pity } = rollPack(pack.type, { sinceEpic: progress.since_epic, sinceLegendary: progress.since_legendary }, ownedIds, pack.quality ?? 0)

      // Allocate every serial from D1 BEFORE any local write that spends a resource or marks
      // the pack opened - if this DO crashed between the two, a burned serial (a cosmetic gap)
      // is an acceptable trade-off; a card minted without a valid serial, or a pack marked
      // opened with no cards to show for it, would not be.
      const serials = await allocateSerials(
        this.env,
        cards.map((c) => ({ cardId: c.cardId, variant: c.variant })),
      )

      const minted = cards.map(({ cardId, rarity, variant }, i) => {
        const serial = serials[i]
        this._insertCardInstance(cardId, variant, serial, `pack:${pack.type}`, now)
        const isNew = !ownedIds.has(cardId)
        ownedIds.add(cardId)
        return { cardId, rarity, variant, serial, isNew }
      })

      this.sql.exec('UPDATE packs SET opened_at = ? WHERE id = ?', now, pack.id)
      this.sql.exec('UPDATE pack_progress SET since_epic = ?, since_legendary = ? WHERE id = 1', pity.sinceEpic, pity.sinceLegendary)
      return { packType: pack.type, cards: minted }
    })
  }

  getCollection() {
    return this.sql.exec('SELECT id, card_id, variant, serial, minted_at FROM card_instances ORDER BY id').toArray()
  }

  getDust() {
    const row = this.sql.exec('SELECT dust FROM pack_progress WHERE id = 1').toArray()[0]
    return row ? row.dust : 0
  }

  /** Everything the /api/collection route needs in one call instead of three separate ones
   *  (getCollection + getDust + getGemSockets) - purely a round-trip optimization, no behavior
   *  difference from calling the three individually. */
  getCollectionSummary() {
    return { cards: this.getCollection(), dust: this.getDust(), gemSockets: this.getGemSockets() }
  }

  /** Settings > "Reset Save" - see db.mjs's old resetPlayerCollection. Doesn't touch the
   *  leaderboard-index row in D1 (the old system never touched profiles'/saves' leaderboard
   *  fields on a collection reset either - only card ownership resets here). */
  resetPlayerCollection() {
    this.sql.exec('DELETE FROM card_instances')
    this.sql.exec('DELETE FROM packs')
    this.sql.exec('DELETE FROM pack_progress')
    this.sql.exec('DELETE FROM daily_pack_progress')
    this.sql.exec('UPDATE profile SET showcase = NULL, gem_sockets = NULL WHERE id = 1')
  }

  /** Refines owned duplicates into dust - see db.mjs's old refineInstances. No await anywhere in
   *  this method, so no blockConcurrencyWhile needed (nothing else can interleave with a plain
   *  synchronous DO call). */
  refineInstances(instanceIds) {
    if (!Array.isArray(instanceIds) || instanceIds.length === 0 || instanceIds.length > 200) return null
    if (!instanceIds.every((id) => Number.isInteger(id))) return null
    if (new Set(instanceIds).size !== instanceIds.length) return null

    const rows = instanceIds.map((id) => this.sql.exec('SELECT id, card_id, variant FROM card_instances WHERE id = ?', id).toArray()[0])
    if (rows.some((r) => r === undefined)) return null

    const perCard = new Map()
    for (const r of rows) perCard.set(r.card_id, (perCard.get(r.card_id) ?? 0) + 1)
    for (const [cardId, n] of perCard) {
      const { c } = this.sql.exec('SELECT COUNT(*) AS c FROM card_instances WHERE card_id = ?', cardId).toArray()[0]
      if (c <= n) return null
    }

    let gained = 0
    for (const r of rows) {
      const rarity = POOL_BY_ID.get(r.card_id)?.rarity ?? 'common'
      gained += refineValue(rarity, r.variant)
      this.sql.exec('DELETE FROM card_instances WHERE id = ?', r.id)
    }
    this.sql.exec('INSERT OR IGNORE INTO pack_progress (id) VALUES (1)')
    this.sql.exec('UPDATE pack_progress SET dust = dust + ? WHERE id = 1', gained)
    const dust = this.sql.exec('SELECT dust FROM pack_progress WHERE id = 1').toArray()[0].dust
    return { refined: rows.length, gained, dust }
  }

  /** Crafts a chosen card for dust - see db.mjs's old craftCard. Same blockConcurrencyWhile
   *  reasoning as openPack: the dust-balance check (read) happens before the D1 serial
   *  allocation (await), so the whole thing needs to be exclusive to stop two concurrent crafts
   *  from both passing the balance check against the same starting dust total. */
  async craftCard(cardId, variant) {
    const def = POOL_BY_ID.get(cardId)
    if (!def || !VARIANT_ORDER.includes(variant)) return null
    const cost = craftCost(def.rarity, variant)

    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now()
      this.sql.exec('INSERT OR IGNORE INTO pack_progress (id) VALUES (1)')
      const { dust } = this.sql.exec('SELECT dust FROM pack_progress WHERE id = 1').toArray()[0]
      if (dust < cost) return null

      // Serial allocated before the dust spend lands, same crash-safety reasoning as openPack.
      const [serial] = await allocateSerials(this.env, [{ cardId, variant }])
      this.sql.exec('UPDATE pack_progress SET dust = dust - ? WHERE id = 1', cost)
      this._insertCardInstance(cardId, variant, serial, 'craft', now)
      const remaining = this.sql.exec('SELECT dust FROM pack_progress WHERE id = 1').toArray()[0].dust
      return { cardId, rarity: def.rarity, variant, serial, cost, dust: remaining }
    })
  }

  // -- Showcase / Gem Sockets --

  setShowcase(cards) {
    if (!Array.isArray(cards) || cards.length > SHOWCASE_MAX) return false
    for (const c of cards) {
      if (!c || typeof c.cardId !== 'string' || !VARIANT_ORDER.includes(c.variant)) return false
      const owned = this.sql.exec('SELECT 1 AS x FROM card_instances WHERE card_id = ? AND variant = ? LIMIT 1', c.cardId, c.variant).toArray()[0]
      if (!owned) return false
    }
    const json = JSON.stringify(cards.map((c) => ({ cardId: c.cardId, variant: c.variant })))
    const now = Date.now()
    this.sql.exec(
      `INSERT INTO profile (id, showcase, first_synced_at, updated_at) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET showcase = excluded.showcase, updated_at = excluded.updated_at`,
      json,
      now,
      now,
    )
    return true
  }

  setGemSockets(sockets) {
    if (!Array.isArray(sockets) || sockets.length > GEM_SOCKETS_MAX) return false
    const seenNodeIds = new Set()
    for (const s of sockets) {
      if (!s || typeof s.nodeId !== 'string' || typeof s.cardId !== 'string' || !VARIANT_ORDER.includes(s.variant)) return false
      if (seenNodeIds.has(s.nodeId)) return false
      seenNodeIds.add(s.nodeId)
      const owned = this.sql.exec('SELECT 1 AS x FROM card_instances WHERE card_id = ? AND variant = ? LIMIT 1', s.cardId, s.variant).toArray()[0]
      if (!owned) return false
    }
    const json = JSON.stringify(sockets.map((s) => ({ nodeId: s.nodeId, cardId: s.cardId, variant: s.variant })))
    const now = Date.now()
    this.sql.exec(
      `INSERT INTO profile (id, gem_sockets, first_synced_at, updated_at) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET gem_sockets = excluded.gem_sockets, updated_at = excluded.updated_at`,
      json,
      now,
      now,
    )
    return true
  }

  getGemSockets() {
    const row = this.sql.exec('SELECT gem_sockets FROM profile WHERE id = 1').toArray()[0]
    if (!row || !row.gem_sockets) return []
    try {
      return JSON.parse(row.gem_sockets)
    } catch {
      return []
    }
  }

  // -- Purchases --

  recordPurchase(item) {
    this.sql.exec('INSERT INTO purchases (item, created_at) VALUES (?, ?)', item, Date.now())
  }

  hasPurchased(item) {
    return this.sql.exec('SELECT 1 AS x FROM purchases WHERE item = ? LIMIT 1', item).toArray().length > 0
  }

  /** Atomically returns unclaimed purchases and marks them claimed, minting any pack they grant
   *  in the same pass - see db.mjs's old claimPurchases. No D1 involvement (granted packs live
   *  in this DO's own packs table), no await, no blockConcurrencyWhile needed. */
  claimPurchases() {
    const now = Date.now()
    const rows = this.sql.exec('SELECT id, item FROM purchases WHERE claimed_at IS NULL').toArray()
    for (const row of rows) {
      this.sql.exec('UPDATE purchases SET claimed_at = ? WHERE id = ?', now, row.id)
      const type = packTypeForPurchaseItem(row.item)
      if (type && PACK_TYPES[type]) this.sql.exec('INSERT INTO packs (type, created_at, quality) VALUES (?, ?, 0)', type, now)
    }
    return rows.map((r) => ({ item: r.item }))
  }

  // -- One-time invoice reservation (replaces server.mjs's in-memory pendingOneTimeInvoices Map -
  //    see the pending_invoices table comment in _initSchema for why it has to be real storage). --

  hasPendingInvoice(itemId) {
    const row = this.sql.exec('SELECT expires_at FROM pending_invoices WHERE item_id = ?', itemId).toArray()[0]
    if (!row) return false
    if (Date.now() > row.expires_at) {
      this.sql.exec('DELETE FROM pending_invoices WHERE item_id = ?', itemId)
      return false
    }
    return true
  }

  reservePendingInvoice(itemId, ttlMs) {
    this.sql.exec(
      `INSERT INTO pending_invoices (item_id, expires_at) VALUES (?, ?)
         ON CONFLICT(item_id) DO UPDATE SET expires_at = excluded.expires_at`,
      itemId,
      Date.now() + ttlMs,
    )
  }

  // -- One-time Railway data migration (see scripts/exportRailwaySqlite.mjs /
  //    adminImport.mjs) - replays this user's exported rows verbatim, including their
  //    PRE-EXISTING card serials. Deliberately does NOT go through allocateSerials()/D1 like
  //    openPack/craftCard do - these are historical facts being replayed, not new mints. The
  //    global card_counters_v ticker itself is seeded separately, directly into D1 by
  //    adminImport.mjs, from the same export's top-level cardCounters array - that's what keeps
  //    FUTURE allocateSerials() calls continuing from the right next_serial after this runs. --

  importLegacyState({ profile, save, purchases, cardInstances, packs, packProgress, dailyPackProgress }) {
    if (profile) {
      this.sql.exec(
        `INSERT INTO profile (id, first_name, username, photo_url, first_synced_at, updated_at, showcase, gem_sockets) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username, photo_url = excluded.photo_url,
             first_synced_at = excluded.first_synced_at, updated_at = excluded.updated_at, showcase = excluded.showcase, gem_sockets = excluded.gem_sockets`,
        profile.first_name ?? null,
        profile.username ?? null,
        profile.photo_url ?? null,
        profile.first_synced_at,
        profile.updated_at,
        profile.showcase ?? null,
        profile.gem_sockets ?? null,
      )
    }
    if (save) {
      this.sql.exec(
        `INSERT INTO saves (id, save_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at`,
        save.saveJson,
        save.updatedAt,
      )
    }
    for (const p of purchases ?? []) this.sql.exec('INSERT INTO purchases (item, created_at, claimed_at) VALUES (?, ?, ?)', p.item, p.created_at, p.claimed_at)
    for (const c of cardInstances ?? []) this._insertCardInstance(c.card_id, c.variant, c.serial, c.source, c.minted_at)
    for (const p of packs ?? []) this.sql.exec('INSERT INTO packs (type, quality, created_at, opened_at) VALUES (?, ?, ?, ?)', p.type, p.quality, p.created_at, p.opened_at)
    if (packProgress) {
      this.sql.exec(
        `INSERT INTO pack_progress (id, bosses_granted, since_epic, since_legendary, dust) VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET bosses_granted = excluded.bosses_granted, since_epic = excluded.since_epic,
             since_legendary = excluded.since_legendary, dust = excluded.dust`,
        packProgress.bosses_granted,
        packProgress.since_epic,
        packProgress.since_legendary,
        packProgress.dust,
      )
    }
    if (dailyPackProgress) {
      this.sql.exec(
        `INSERT INTO daily_pack_progress (id, last_streak_granted) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET last_streak_granted = excluded.last_streak_granted`,
        dailyPackProgress.last_streak_granted,
      )
    }
    return { imported: true }
  }

  // -- Thin fetch() router - see the file header for why this is fetch-based, not native RPC. --
  async fetch(request) {
    const method = new URL(request.url).pathname.slice(1)
    const args = request.method === 'POST' ? await request.json() : {}
    try {
      const result = await this._dispatch(method, args)
      return Response.json({ result })
    } catch (e) {
      return Response.json({ error: String(e && e.message ? e.message : e) }, { status: 500 })
    }
  }

  _dispatch(method, a) {
    switch (method) {
      case 'sync-save':
        return this.syncSave(a.telegramUserId, a.saveJson, a.profileFields)
      case 'get-save':
        return this.getSave()
      case 'get-profile':
        return this.getProfile()
      case 'list-unopened-packs':
        return this.listUnopenedPacks()
      case 'open-pack':
        return this.openPack(a.packId)
      case 'get-collection':
        return this.getCollection()
      case 'get-dust':
        return this.getDust()
      case 'get-collection-summary':
        return this.getCollectionSummary()
      case 'reset-player-collection':
        return this.resetPlayerCollection()
      case 'refine-instances':
        return this.refineInstances(a.instanceIds)
      case 'craft-card':
        return this.craftCard(a.cardId, a.variant)
      case 'set-showcase':
        return this.setShowcase(a.cards)
      case 'set-gem-sockets':
        return this.setGemSockets(a.sockets)
      case 'get-gem-sockets':
        return this.getGemSockets()
      case 'record-purchase':
        return this.recordPurchase(a.item)
      case 'has-purchased':
        return this.hasPurchased(a.item)
      case 'claim-purchases':
        return this.claimPurchases()
      case 'has-pending-invoice':
        return this.hasPendingInvoice(a.itemId)
      case 'reserve-pending-invoice':
        return this.reservePendingInvoice(a.itemId, a.ttlMs)
      case 'import-legacy-state':
        return this.importLegacyState(a)
      default:
        throw new Error(`unknown PlayerDO method: ${method}`)
    }
  }
}

/** worker.mjs's only way to reach a player's DO - routes by telegram_user_id, never by anything
 *  client-supplied-and-unverified (callers must have already run validateInitData). */
export function getPlayerStub(env, telegramUserId) {
  const id = env.PLAYER_DO.idFromName(String(telegramUserId))
  return env.PLAYER_DO.get(id)
}

/** Calls one PlayerDO method over its fetch() router and unwraps the JSON envelope. Throws on
 *  any DO-side error (a 500 response) so callers can let it bubble into their own try/catch,
 *  same as every other operation in worker.mjs's route handlers. */
export async function callPlayerDO(env, telegramUserId, method, args = {}) {
  const stub = getPlayerStub(env, telegramUserId)
  const res = await stub.fetch(`http://player-do/${method}`, { method: 'POST', body: JSON.stringify(args) })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `PlayerDO ${method} failed`)
  return body.result
}
