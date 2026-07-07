import 'dotenv/config'
import { Bot } from 'grammy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { recordPurchase } from './db.mjs'
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

bot.command('start', async (ctx) => {
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

bot.start({
  onStart: (info) => console.log(`Polling started as @${info.username}. Mini App URL: ${webAppUrl}`),
}).catch((err) => console.error('bot.start() rejected:', err))

startServer(token, process.env.PORT || 3000)

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err))
