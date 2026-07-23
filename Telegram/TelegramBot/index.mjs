import 'dotenv/config'
import { Bot } from 'grammy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { getUsersDueForReengagement, markNotified, recordPurchase, recordReferral, setNotificationsEnabled } from './db.mjs'
import { startServer } from './server.mjs'

const token = process.env.BOT_TOKEN
const webAppUrl = process.env.WEBAPP_URL
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy

if (!token) throw new Error('Missing BOT_TOKEN in .env (get one from @BotFather)')
if (!webAppUrl) throw new Error('Missing WEBAPP_URL in .env (e.g. your cloudflared https://*.trycloudflare.com URL)')

// grammY's Node build uses node-fetch internally, which ignores HTTPS_PROXY/undici's
// global dispatcher entirely - it needs an explicit proxy agent passed through.
const bot = proxyUrl
  ? new Bot(token, { client: { baseFetchConfig: { agent: new HttpsProxyAgent(proxyUrl) } } })
  : new Bot(token)

if (proxyUrl) console.log(`Routing bot API requests through proxy: ${proxyUrl}`)

bot.use(async (ctx, next) => {
  console.log('Update from', ctx.from?.username ?? ctx.from?.id, ':', ctx.message?.text ?? '(non-text update)')
  await next()
})

// Referral tracking only - no rewards granted here (Phase 3, gated on a future economy
// proposal). ctx.match is whatever follows "/start " - a shared link of the form
// t.me/<bot>?start=ref_<id> arrives as "ref_<id>" here on the referred user's very first
// /start. First-touch wins and self-referral is a no-op (see recordReferral in db.mjs).
bot.command('start', async (ctx) => {
  const match = ctx.match.match(/^ref_(\d+)$/)
  if (match) recordReferral(ctx.from.id, Number(match[1]))

  await ctx.reply('Tap below to launch Stellar Breaker.', {
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 Play Stellar Breaker', web_app: { url: webAppUrl } }]],
    },
  })
})

// Monetization: a single Stars-payable test item. Telegram Stars payments use currency
// "XTR" and need no provider_token (Telegram settles them natively). The purchase is
// recorded here and credited into the game next time the Mini App calls
// POST /api/claim-purchases (see server.mjs) - the item id below ("stardust_pack_500")
// must match the grant mapping in TelegramApp/src/game/monetization/purchases.ts.
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
  recordPurchase(ctx.from.id, invoice_payload)
  console.log('Payment received:', ctx.message.successful_payment)
  await ctx.reply("Thanks for your purchase! Open Stellar Breaker to collect it - it'll be waiting for you.")
})

bot.catch((err) => console.error('Bot error:', err))

// Phase 2 (engagement roadmap): a single, conservative re-engagement reminder for players who
// haven't synced in a while - one nudge per idle stretch, never a hot loop. The bot process
// already runs 24/7 (long-polling), so an in-process interval needs no separate cron infra.
const REENGAGEMENT_IDLE_MS = 24 * 60 * 60 * 1000 // hasn't synced in ~a day
const REENGAGEMENT_COOLDOWN_MS = 20 * 60 * 60 * 1000 // won't re-notify inside this window
const REENGAGEMENT_CHECK_INTERVAL_MS = 60 * 60 * 1000 // how often to scan for idle players

async function notifyIdlePlayers() {
  const userIds = getUsersDueForReengagement(REENGAGEMENT_IDLE_MS, REENGAGEMENT_COOLDOWN_MS)
  for (const userId of userIds) {
    try {
      await bot.api.sendMessage(userId, "🚀 Your fleet's been idle, Commander! Come back and keep the Stardust flowing.", {
        reply_markup: { inline_keyboard: [[{ text: '🚀 Play Stellar Breaker', web_app: { url: webAppUrl } }]] },
      })
      markNotified(userId)
    } catch (e) {
      if (e.error_code === 403) {
        // Blocked the bot - a clearer signal than the in-game toggle. Stop retrying entirely
        // rather than re-attempting (and failing) every cooldown window forever.
        setNotificationsEnabled(userId, false)
      } else {
        console.warn('[notify] failed to message', userId, ':', e.message)
        markNotified(userId) // still cool down before retrying a transient failure
      }
    }
  }
  if (userIds.length > 0) console.log(`[notify] sent re-engagement reminder to ${userIds.length} player(s)`)
}

setInterval(() => notifyIdlePlayers().catch((e) => console.error('[notify] tick failed:', e)), REENGAGEMENT_CHECK_INTERVAL_MS)

bot.start({
  onStart: (info) => console.log(`Polling started as @${info.username}. Mini App URL: ${webAppUrl}`),
}).catch((err) => console.error('bot.start() rejected:', err))

startServer(bot, process.env.PORT || 3000)

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err))
