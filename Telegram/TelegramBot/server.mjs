import { createServer } from 'node:http'
import { validateInitData } from './validateInitData.mjs'
import { claimPurchases, getCollection, getProfile, getSave, grantPacksFromSave, listUnopenedPacks, openPack, putSave, upsertProfile } from './db.mjs'

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
  }
}

export function startServer(botToken, port) {
  const server = createServer(async (req, res) => {
    withCors(req, res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
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
        sendJson(res, 200, { cards: getCollection(userId) })
      } catch (e) {
        console.error('[server] collection error:', e)
        sendJson(res, 400, { error: 'bad request' })
      }
      return
    }

    // Public read-only profile (no auth: it exposes only display identity + progression
    // stats, never the raw save). Powers visitor profile views / future leaderboards.
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
