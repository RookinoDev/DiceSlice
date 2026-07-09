// Regenerates TelegramBot/cardPool.json (id + rarity per card) from the card catalog,
// so the server can roll packs without sharing a build with the app. Run after any
// catalog edit: `npm run gen:cardpool`.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const catalogPath = join(here, '../src/game/cards/catalog.ts')
const outPath = join(here, '../../TelegramBot/cardPool.json')

const src = readFileSync(catalogPath, 'utf8')
// Matches: c(no, 'id', 'NAME'|"NAME", 'classification', 'rarity', ...
const re = /c\(\s*(\d+),\s*'([^']+)',\s*(?:'[^']*'|"[^"]*"),\s*'[^']*',\s*'(\w+)'/g
const cards = []
let m
while ((m = re.exec(src)) !== null) {
  cards.push({ no: Number(m[1]), id: m[2], rarity: m[3] })
}
if (cards.length === 0) throw new Error('no cards parsed - catalog format changed?')

// Generated extension: one card per roster object, identity from the SAME rules module the
// app uses (rosterCardRules.mjs) so server rarities can never drift from the client's.
const { entries } = JSON.parse(readFileSync(join(here, '../src/planet/generatedRoster.json'), 'utf8'))
const { slugForName, rarityForEntry } = await import('../src/game/cards/rosterCardRules.mjs')
for (const entry of entries) {
  cards.push({ no: cards.length + 1, id: slugForName(entry.n), rarity: rarityForEntry(entry) })
}

const dupes = cards.length - new Set(cards.map((c) => c.id)).size
if (dupes > 0) throw new Error(`duplicate card ids: ${dupes}`)

writeFileSync(outPath, JSON.stringify(cards) + '\n')
const byRarity = {}
for (const c of cards) byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1
console.log(`wrote ${cards.length} cards -> ${outPath}`)
console.log(byRarity)
