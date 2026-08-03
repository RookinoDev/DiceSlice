// Worker entry point - replaces index.mjs (bot bootstrap) + server.mjs (REST API) combined,
// since a Worker has exactly one fetch() entry point rather than two separate processes/ports.
// fetch() routes /telegram-webhook to grammY's webhookCallback (long-polling -> webhook, see
// playerDurableObject.mjs's header for why) plus the same ~16 REST routes server.mjs served,
// each now either a PlayerDO call (per-user - see playerDurableObject.mjs) or a d1.mjs call
// (cross-user - see migrations/0001_init.sql for why each thing lives where it does).
// scheduled() replaces index.mjs's hourly setInterval re-engagement scan with a Cron Trigger
// (see wrangler.toml's [triggers]).
import { Api, Bot, webhookCallback } from 'grammy'
import { validateInitData } from './validateInitData.mjs'
import { getShopItem, SHOP_ITEMS } from './shop.mjs'
import { callPlayerDO } from './playerDurableObject.mjs'
import { getAdminStats, getLeaderboard, getUsersDueForReengagement, markNotified, recordEvent, recordReferral, setNotificationsEnabled } from './d1.mjs'

export { PlayerDO } from './playerDurableObject.mjs'

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/stellar-breaker\.pages\.dev$/,
  /^https:\/\/[a-z0-9]+\.stellar-breaker\.pages\.dev$/, // Cloudflare Pages preview deployments
  /^http:\/\/localhost:\d+$/, // local dev
]

/** Request bodies larger than this are rejected outright (saves are ~2KB in practice) - Workers
 *  itself has no such cap, so this is still an explicit choice, not inherited from the platform. */
const MAX_BODY_BYTES = 64 * 1024

/** One-time shop items (Starter Pack, offline cap boost) must only ever be invoiced once, but
 *  hasPurchased only reflects a COMPLETED payment (recorded in message:successful_payment below) -
 *  nothing blocks a second invoice for the same item while the first is still awaiting payment.
 *  This reservation closes that window without touching the payment-recording path. Was an
 *  in-memory Map on the old single Railway process; now DO storage (see
 *  playerDurableObject.mjs's pending_invoices table / hasPendingInvoice / reservePendingInvoice) -
 *  a plain Worker-scope Map wouldn't work here since a Worker has no persistent process the way
 *  Railway's did (every request can hit a different isolate). */
const PENDING_INVOICE_TTL_MS = 15 * 60 * 1000

function isAllowedOrigin(origin) {
  return !!origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

function corsHeaders(request) {
  const origin = request.headers.get('origin')
  if (!isAllowedOrigin(origin)) return {}
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
}

function json(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...extraHeaders } })
}

async function readJsonBody(request) {
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new Error('body too large')
  return text ? JSON.parse(text) : {}
}

/** Validates body.initData and returns the Telegram user id, or null (caller sends 401). */
function requireUser(body, botToken) {
  const { valid, userId } = validateInitData(body.initData, botToken)
  return valid ? userId : null
}

/** The public slice of a profile + its synced save - never exposes the raw save blob. Moved
 *  here from db.mjs's old publicProfilePayload since it's presentation shaping (deriving a few
 *  display fields from the save JSON), not data access - PlayerDO's getProfile() just hands back
 *  the raw row + save_json, same split cardsApi.ts-style code elsewhere in this project uses. */
function publicProfilePayload(telegramUserId, row) {
  let save = null
  try {
    save = row.save_json ? JSON.parse(row.save_json) : null
  } catch {
    save = null
  }
  let showcase = []
  try {
    showcase = row.showcase ? JSON.parse(row.showcase) : []
  } catch {
    showcase = []
  }
  return {
    userId: telegramUserId,
    firstName: row.first_name,
    username: row.username,
    photoUrl: row.photo_url,
    firstSyncedAt: row.first_synced_at,
    highestStage: save?.highestStage ?? null,
    relics: save?.relics ?? null,
    dailyStreak: save?.dailyStreak ?? null,
    stats: save?.stats ?? null,
    showcase,
  }
}

function buildBot(env) {
  const bot = new Bot(env.BOT_TOKEN)

  bot.use(async (ctx, next) => {
    console.log('Update from', ctx.from?.username ?? ctx.from?.id, ':', ctx.message?.text ?? '(non-text update)')
    await next()
  })

  // ctx.match is whatever follows "/start " - a shared link of the form t.me/<bot>?start=ref_<id>
  // arrives as "ref_<id>" here on the referred user's very first /start. First-touch wins and
  // self-referral is a no-op (see recordReferral in d1.mjs). The referred player's welcome
  // reward is granted right here (recordReferral returning true means this genuinely just got
  // recorded, so a repeat /start from the same chat never re-grants it) - it's claimed the same
  // way any other purchase is, the moment the Mini App first calls /api/claim-purchases. The
  // referrer's matching reward is bigger-stakes (paid out from a stranger's actions) and waits
  // for the referred player's first real save sync - see rewardReferrerIfDue in d1.mjs.
  bot.command('start', async (ctx) => {
    const match = ctx.match.match(/^ref_(\d+)$/)
    if (match && (await recordReferral(env, ctx.from.id, Number(match[1])))) {
      await callPlayerDO(env, ctx.from.id, 'record-purchase', { item: 'referral_welcome' })
    }

    await ctx.reply('Tap below to launch Stellar Breaker.', {
      reply_markup: { inline_keyboard: [[{ text: '🚀 Play Stellar Breaker', web_app: { url: env.WEBAPP_URL } }]] },
    })
  })

  // Monetization: a single Stars-payable test item, same as the old /shop chat command - the
  // in-app Shop's own invoice flow is the /api/shop/invoice route below, unrelated to this.
  bot.command('shop', async (ctx) => {
    await ctx.replyWithInvoice('Bonus Stardust Pack', '500 bonus Stardust (demo item), paid with Telegram Stars.', 'stardust_pack_500', 'XTR', [
      { label: '500 Stardust', amount: 25 },
    ])
  })

  bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true)
  })

  bot.on('message:successful_payment', async (ctx) => {
    const { invoice_payload } = ctx.message.successful_payment
    await callPlayerDO(env, ctx.from.id, 'record-purchase', { item: invoice_payload })
    // Revenue event - the real money-in signal (an invoice can be opened and abandoned; this
    // fires only once Telegram confirms the Stars payment). valueStars comes from our own
    // catalog, not the payment payload, so a tampered client can't skew revenue reporting.
    const item = getShopItem(invoice_payload)
    await recordEvent(env, { type: 'purchase_completed', telegramUserId: ctx.from.id, item: invoice_payload, valueStars: item?.priceStars ?? null })
    console.log('Payment received:', ctx.message.successful_payment)
    await ctx.reply("Thanks for your purchase! Open Stellar Breaker to collect it - it'll be waiting for you.")
  })

  bot.catch((err) => console.error('Bot error:', err))
  return bot
}

async function handleApi(request, env) {
  const url = new URL(request.url)
  const cors = corsHeaders(request)

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  // Push-notification opt-in/out (Settings > Notifications toggle) - the bot's idle reminder
  // (see scheduled() below) reads this straight from D1, no PlayerDO involvement.
  if (request.method === 'POST' && url.pathname === '/api/notification-prefs') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      await setNotificationsEnabled(env, userId, !!body.enabled)
      return json(200, { ok: true }, cors)
    } catch (e) {
      console.error('[worker] notification-prefs error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  // In-app Shop catalog - server-authoritative, the client only ever renders what this returns.
  if (request.method === 'POST' && url.pathname === '/api/shop/items') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const oneTimeItems = SHOP_ITEMS.filter((item) => item.oneTime)
      const purchasedFlags = await Promise.all(oneTimeItems.map((item) => callPlayerDO(env, userId, 'has-purchased', { item: item.id })))
      const purchased = oneTimeItems.filter((_, i) => purchasedFlags[i]).map((item) => item.id)
      return json(200, { items: SHOP_ITEMS, purchased }, cors)
    } catch (e) {
      console.error('[worker] shop/items error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  // Mints a Telegram Stars invoice link for Telegram.WebApp.openInvoice() to open in-app.
  // Payment completion still arrives via the bot's message:successful_payment handler above.
  if (request.method === 'POST' && url.pathname === '/api/shop/invoice') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const item = getShopItem(String(body.itemId ?? ''))
      if (!item) return json(400, { error: 'unknown item' }, cors)
      if (item.oneTime) {
        const alreadyPurchased = await callPlayerDO(env, userId, 'has-purchased', { item: item.id })
        if (alreadyPurchased) return json(409, { error: 'already purchased' }, cors)
        const hasPending = await callPlayerDO(env, userId, 'has-pending-invoice', { itemId: item.id })
        if (hasPending) return json(409, { error: 'already purchased' }, cors)
        await callPlayerDO(env, userId, 'reserve-pending-invoice', { itemId: item.id, ttlMs: PENDING_INVOICE_TTL_MS })
      }
      const api = new Api(env.BOT_TOKEN)
      // Stars payments use currency "XTR" and an empty provider_token - Telegram settles them
      // natively, no payment provider involved.
      const url_ = await api.createInvoiceLink(item.title, item.description, item.id, '', 'XTR', [{ label: item.title, amount: item.priceStars }])
      // Funnel-start event - paired with purchase_completed to get invoice->purchase conversion
      // per SKU (see getAdminStats). Opening an invoice isn't paying for it, so this is a
      // "seriously considered buying" signal, not revenue.
      await recordEvent(env, { type: 'invoice_created', telegramUserId: userId, item: item.id, valueStars: item.priceStars })
      return json(200, { url: url_ }, cors)
    } catch (e) {
      console.error('[worker] shop/invoice error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/claim-purchases') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const grants = await callPlayerDO(env, userId, 'claim-purchases')
      return json(200, { grants }, cors)
    } catch (e) {
      console.error('[worker] claim-purchases error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  // Cloud save sync - the client owns conflict resolution, so this is a dumb per-user blob
  // store; it only enforces auth, shape, and size.
  if (request.method === 'POST' && url.pathname === '/api/save') {
    try {
      const body = await readJsonBody(request)
      const { valid, userId, user } = validateInitData(body.initData, env.BOT_TOKEN)
      if (!valid) return json(401, { error: 'invalid initData' }, cors)
      if (!body.save || typeof body.save !== 'object' || Array.isArray(body.save)) return json(400, { error: 'save must be an object' }, cors)
      const { pendingPacks } = await callPlayerDO(env, userId, 'sync-save', {
        telegramUserId: userId,
        saveJson: JSON.stringify(body.save),
        profileFields: { firstName: user.first_name, username: user.username, photoUrl: user.photo_url },
      })
      return json(200, { ok: true, pendingPacks }, cors)
    } catch (e) {
      console.error('[worker] save error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/packs') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const packs = await callPlayerDO(env, userId, 'list-unopened-packs')
      return json(200, { packs }, cors)
    } catch (e) {
      console.error('[worker] packs error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/packs/open') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const packId = Number(body.packId)
      if (!Number.isInteger(packId)) return json(400, { error: 'bad packId' }, cors)
      const result = await callPlayerDO(env, userId, 'open-pack', { packId })
      if (!result) return json(404, { error: 'pack not found' }, cors)
      return json(200, result, cors)
    } catch (e) {
      console.error('[worker] pack-open error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/collection') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const { cards, dust, gemSockets } = await callPlayerDO(env, userId, 'get-collection-summary')
      return json(200, { cards, dust, gemSockets }, cors)
    } catch (e) {
      console.error('[worker] collection error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/cards/refine') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const result = await callPlayerDO(env, userId, 'refine-instances', { instanceIds: body.instanceIds })
      if (!result) return json(400, { error: 'not refinable' }, cors)
      return json(200, result, cors)
    } catch (e) {
      console.error('[worker] refine error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/cards/craft') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const result = await callPlayerDO(env, userId, 'craft-card', { cardId: String(body.cardId ?? ''), variant: String(body.variant ?? 'standard') })
      if (!result) return json(400, { error: 'cannot craft' }, cors)
      return json(200, result, cors)
    } catch (e) {
      console.error('[worker] craft error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/showcase') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const ok = await callPlayerDO(env, userId, 'set-showcase', { cards: body.cards })
      if (!ok) return json(400, { error: 'invalid showcase' }, cors)
      return json(200, { ok: true }, cors)
    } catch (e) {
      console.error('[worker] showcase error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/gem-sockets') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const ok = await callPlayerDO(env, userId, 'set-gem-sockets', { sockets: body.sockets })
      if (!ok) return json(400, { error: 'invalid gem sockets' }, cors)
      return json(200, { ok: true }, cors)
    } catch (e) {
      console.error('[worker] gem-sockets error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/reset') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      await callPlayerDO(env, userId, 'reset-player-collection')
      return json(200, { ok: true }, cors)
    } catch (e) {
      console.error('[worker] reset error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  // Public read-only profile (no auth: identity + progression stats only, never the raw save).
  if (request.method === 'GET' && url.pathname === '/api/profile') {
    try {
      const id = Number(url.searchParams.get('id'))
      if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'bad id' }, cors)
      const row = await callPlayerDO(env, id, 'get-profile')
      if (!row) return json(404, { error: 'not found' }, cors)
      return json(200, { profile: publicProfilePayload(id, row) }, cors)
    } catch (e) {
      console.error('[worker] profile error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  // Public leaderboard (no auth, same reasoning as /api/profile) - degrades to an empty list
  // rather than a 400 on any failure, since this is a purely cosmetic feature.
  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    try {
      const sortBy = url.searchParams.get('sortBy') || 'deepestStage'
      const limit = url.searchParams.get('limit')
      const entries = await getLeaderboard(env, sortBy, limit)
      return json(200, { entries, sortBy }, cors)
    } catch (e) {
      console.error('[worker] leaderboard error:', e)
      return json(200, { entries: [], sortBy: null }, cors)
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/load') {
    try {
      const body = await readJsonBody(request)
      const userId = requireUser(body, env.BOT_TOKEN)
      if (userId === null) return json(401, { error: 'invalid initData' }, cors)
      const saveJson = await callPlayerDO(env, userId, 'get-save')
      return json(200, { save: saveJson ? JSON.parse(saveJson) : null }, cors)
    } catch (e) {
      console.error('[worker] load error:', e)
      return json(400, { error: 'bad request' }, cors)
    }
  }

  // Revenue/funnel dashboard - for the developer, not a player, so it's gated by a secret header
  // (`wrangler secret put ADMIN_STATS_SECRET`) instead of Telegram initData auth.
  if (request.method === 'GET' && url.pathname === '/api/admin/stats') {
    if (!env.ADMIN_STATS_SECRET || request.headers.get('x-admin-secret') !== env.ADMIN_STATS_SECRET) return json(401, { error: 'unauthorized' })
    try {
      return json(200, await getAdminStats(env))
    } catch (e) {
      console.error('[worker] admin/stats error:', e)
      return json(500, { error: 'internal error' })
    }
  }

  return new Response(null, { status: 404 })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/telegram-webhook') {
      return webhookCallback(buildBot(env), 'cloudflare-mod')(request)
    }
    return handleApi(request, env)
  },

  // Replaces index.mjs's setInterval re-engagement scan - a Worker has no persistent process to
  // run one in, so this runs once per Cron Trigger fire instead (see wrangler.toml's
  // [triggers], "0 * * * *" - hourly, same cadence as the old REENGAGEMENT_CHECK_INTERVAL_MS).
  async scheduled(event, env, ctx) {
    const REENGAGEMENT_IDLE_MS = 24 * 60 * 60 * 1000 // hasn't synced in ~a day
    const REENGAGEMENT_COOLDOWN_MS = 20 * 60 * 60 * 1000 // won't re-notify inside this window

    const api = new Api(env.BOT_TOKEN)
    const userIds = await getUsersDueForReengagement(env, REENGAGEMENT_IDLE_MS, REENGAGEMENT_COOLDOWN_MS)
    for (const userId of userIds) {
      try {
        await api.sendMessage(userId, "🚀 Your fleet's been idle, Commander! Come back and keep the Stardust flowing.", {
          reply_markup: { inline_keyboard: [[{ text: '🚀 Play Stellar Breaker', web_app: { url: env.WEBAPP_URL } }]] },
        })
        await markNotified(env, userId)
      } catch (e) {
        if (e.error_code === 403) {
          // Blocked the bot - a clearer signal than the in-game toggle. Stop retrying entirely
          // rather than re-attempting (and failing) every cooldown window forever.
          await setNotificationsEnabled(env, userId, false)
        } else {
          console.warn('[notify] failed to message', userId, ':', e.message)
          await markNotified(env, userId) // still cool down before retrying a transient failure
        }
      }
    }
    if (userIds.length > 0) console.log(`[notify] sent re-engagement reminder to ${userIds.length} player(s)`)
  },
}
