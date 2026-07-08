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
const dupes = cards.length - new Set(cards.map((c) => c.id)).size
if (dupes > 0) throw new Error(`duplicate card ids: ${dupes}`)

writeFileSync(outPath, JSON.stringify(cards, null, 1) + '\n')
console.log(`wrote ${cards.length} cards -> ${outPath}`)
