import { createServer } from 'node:http'
import { validateInitData } from './validateInitData.mjs'
import { getShopItem, SHOP_ITEMS } from './shop.mjs'
import {
  claimPurchases,
  craftCard,
  getCollection,
  getDust,
  getLeaderboard,
  getProfile,
  getSave,
  grantDailyPackFromSave,
  grantPacksFromSave,
  hasPurchased,
  listUnopenedPacks,
  openPack,
  putSave,
  refineInstances,
  setNotificationsEnabled,
  setShowcase,
  upsertProfile,
} from './db.mjs'

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/stellar-breaker\.pages\.dev$/,
  /^https:\/\/[a-z0-9]+\.stellar-breaker\.pages\.dev$/, // Cloudflare Pages preview deployments
  /^http:\/\/localhost:\d+$/, // local dev
]

/** Request bodies larger than this are rejected outright (saves are ~2KB in practice). */
const MAX_BODY_BYTES = 64 * 1024

function isAllowedOrigin(origin) {
  return !!origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

function withCors(req, res) {
  const origin = req.headers.origin
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
}

async function readJsonBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new Error('body too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/** Validates body.initData and returns the Telegram user id, or responds 401 and returns null. */
function requireUser(body, res, botToken) {
  const { valid, userId } = validateInitData(body.initData, botToken)
  if (!valid) {
    sendJson(res, 401, { error: 'invalid initData' })
    return null
  }
  return userId
}

/** The public slice of a profile row + its synced save. Never exposes the raw save blob. */
function publicProfilePayload(row) {
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
    userId: row.telegram_user_id,
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

export function startServer(bot, port) {
  const botToken = bot.token
  const server = createServer(async (req, res) => {
    withCors(req, res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Push-notification opt-in/out (Settings > Notifications toggle), so the bot's idle
    // reminder (see notifyIdlePlayers in index.mjs) can respect it without needing the save
    // blob at all - fired only when the user actually flips the toggle, best-effort.
    if (req.method === 'POST' && req.url === '/api/notification-prefs') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        setNotificationsEnabled(userId, !!body.enabled)
        sendJson(res, 200, { ok: true })
      } catch (e) {
        console.error('[server] notification-prefs error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // In-app Shop (see TelegramApp/src/ui/sheets/ShopSheet.tsx). Catalog is server-authoritative
    // (see shop.mjs) - the client only ever renders what this returns. `purchased` lists this
    // user's already-bought one-time item ids, so the UI can grey them out without a second
    // round-trip per item.
    if (req.method === 'POST' && req.url === '/api/shop/items') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        const purchased = SHOP_ITEMS.filter((item) => item.oneTime && hasPurchased(userId, item.id)).map((item) => item.id)
        sendJson(res, 200, { items: SHOP_ITEMS, purchased })
      } catch (e) {
        console.error('[server] shop/items error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Mints a Telegram Stars invoice link for Telegram.WebApp.openInvoice() to open in-app -
    // the same payment flow the old "/shop" chat command used (replyWithInvoice), just
    // triggered from inside the Mini App instead of a bot command. Payment completion still
    // arrives via the bot's message:successful_payment handler in index.mjs unchanged.
    if (req.method === 'POST' && req.url === '/api/shop/invoice') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        const item = getShopItem(String(body.itemId ?? ''))
        if (!item) {
          sendJson(res, 400, { error: 'unknown item' })
          return
        }
        if (item.oneTime && hasPurchased(userId, item.id)) {
          sendJson(res, 409, { error: 'already purchased' })
          return
        }
        // Stars payments use currency "XTR" and an empty provider_token - Telegram settles
        // them natively, no payment provider involved.
        const url = await bot.api.createInvoiceLink(item.title, item.description, item.id, '', 'XTR', [{ label: item.title, amount: item.priceStars }])
        sendJson(res, 200, { url })
      } catch (e) {
        console.error('[server] shop/invoice error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    if (req.method === 'POST' && req.url === '/api/claim-purchases') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        sendJson(res, 200, { grants: claimPurchases(userId) })
      } catch (e) {
        console.error('[server] claim-purchases error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Cloud save endpoints for TelegramApp/src/game/persistence/cloudSave.ts. The client
    // owns conflict resolution (it compares progress before pushing), so the server is a
    // dumb per-user blob store; it only enforces auth, shape, and size.
    if (req.method === 'POST' && req.url === '/api/save') {
      try {
        const body = await readJsonBody(req)
        const { valid, userId, user } = validateInitData(body.initData, botToken)
        if (!valid) {
          sendJson(res, 401, { error: 'invalid initData' })
          return
        }
        if (!body.save || typeof body.save !== 'object' || Array.isArray(body.save)) {
          sendJson(res, 400, { error: 'save must be an object' })
          return
        }
        putSave(userId, JSON.stringify(body.save))
        // Saves are the profile heartbeat: refresh Telegram-signed identity on each sync.
        upsertProfile(userId, { firstName: user.first_name, username: user.username, photoUrl: user.photo_url })
        // ...and the pack-earning heartbeat: new boss kills in the save grant card packs.
        grantPacksFromSave(userId, body.save)
        // ...and daily-login pack days (10/20/30 of the cycle) grant a pack too.
        grantDailyPackFromSave(userId, body.save)
        sendJson(res, 200, { ok: true, pendingPacks: listUnopenedPacks(userId).length })
      } catch (e) {
        console.error('[server] save error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Card packs + collection (docs/CARD_SYSTEM_PLAN.md phase 1). The server rolls all
    // pack contents and mints serials; the client only animates results.
    if (req.method === 'POST' && req.url === '/api/packs') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        sendJson(res, 200, { packs: listUnopenedPacks(userId) })
      } catch (e) {
        console.error('[server] packs error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    if (req.method === 'POST' && req.url === '/api/packs/open') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        const packId = Number(body.packId)
        if (!Number.isInteger(packId)) {
          sendJson(res, 400, { error: 'bad packId' })
          return
        }
        const result = openPack(userId, packId)
        if (!result) {
          sendJson(res, 404, { error: 'pack not found' })
          return
        }
        sendJson(res, 200, result)
      } catch (e) {
        console.error('[server] pack-open error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    if (req.method === 'POST' && req.url === '/api/collection') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        sendJson(res, 200, { cards: getCollection(userId), dust: getDust(userId) })
      } catch (e) {
        console.error('[server] collection error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Duplicate economy: refine dupes into dust, craft chosen cards/variants from dust.
    if (req.method === 'POST' && req.url === '/api/cards/refine') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        const result = refineInstances(userId, body.instanceIds)
        if (!result) {
          sendJson(res, 400, { error: 'not refinable' })
          return
        }
        sendJson(res, 200, result)
      } catch (e) {
        console.error('[server] refine error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    if (req.method === 'POST' && req.url === '/api/cards/craft') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        const result = craftCard(userId, String(body.cardId ?? ''), String(body.variant ?? 'standard'))
        if (!result) {
          sendJson(res, 400, { error: 'cannot craft' })
          return
        }
        sendJson(res, 200, result)
      } catch (e) {
        console.error('[server] craft error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Profile showcase: an ordered list of owned (cardId, variant) pairs, public via /api/profile.
    if (req.method === 'POST' && req.url === '/api/showcase') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        if (!setShowcase(userId, body.cards)) {
          sendJson(res, 400, { error: 'invalid showcase' })
          return
        }
        sendJson(res, 200, { ok: true })
      } catch (e) {
        console.error('[server] showcase error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Public read-only profile (no auth: it exposes only display identity + progression
    // stats, never the raw save). Powers visitor profile views and the leaderboard below.
    if (req.method === 'GET' && req.url?.startsWith('/api/profile?')) {
      try {
        const id = Number(new URL(req.url, 'http://x').searchParams.get('id'))
        if (!Number.isInteger(id) || id <= 0) {
          sendJson(res, 400, { error: 'bad id' })
          return
        }
        const row = getProfile(id)
        if (!row) {
          sendJson(res, 404, { error: 'not found' })
          return
        }
        sendJson(res, 200, { profile: publicProfilePayload(row) })
      } catch (e) {
        console.error('[server] profile error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Public leaderboard (no auth, same reasoning as /api/profile above - display-only
    // aggregate stats, never the raw save). An unrecognized sortBy - or any getLeaderboard
    // failure - degrades to an empty list rather than a 400, so a stale/mistyped client build
    // renders "no entries" instead of an error state for what is a purely cosmetic feature.
    if (req.method === 'GET' && req.url?.startsWith('/api/leaderboard?')) {
      try {
        const params = new URL(req.url, 'http://x').searchParams
        const sortBy = params.get('sortBy') || 'deepestStage'
        const limit = params.get('limit')
        sendJson(res, 200, { entries: getLeaderboard(sortBy, limit), sortBy })
      } catch (e) {
        console.error('[server] leaderboard error:', e)
        sendJson(res, 200, { entries: [], sortBy: null })
      }
      return
    }

    if (req.method === 'POST' && req.url === '/api/load') {
      try {
        const body = await readJsonBody(req)
        const userId = requireUser(body, res, botToken)
        if (userId === null) return
        const json = getSave(userId)
        sendJson(res, 200, { save: json ? JSON.parse(json) : null })
      } catch (e) {
        console.error('[server] load error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    res.writeHead(404)
    res.end()
  })

  server.listen(port, () => console.log(`HTTP API listening on port ${port}`))
  return server
}
