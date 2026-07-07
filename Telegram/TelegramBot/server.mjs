import { createServer } from 'node:http'
import { validateInitData } from './validateInitData.mjs'
import { claimPurchases } from './db.mjs'

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/stellar-breaker\.pages\.dev$/,
  /^https:\/\/[a-z0-9]+\.stellar-breaker\.pages\.dev$/, // Cloudflare Pages preview deployments
  /^http:\/\/localhost:\d+$/, // local dev
]

function isAllowedOrigin(origin) {
  return !!origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))
}

function withCors(req, res) {
  const origin = req.headers.origin
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
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
        const { valid, userId } = validateInitData(body.initData, botToken)
        if (!valid) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'invalid initData' }))
          return
        }
        const grants = claimPurchases(userId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ grants }))
      } catch (e) {
        console.error('[server] claim-purchases error:', e)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'bad request' }))
      }
      return
    }

    res.writeHead(404)
    res.end()
  })

  server.listen(port, () => console.log(`HTTP API listening on port ${port}`))
  return server
}
