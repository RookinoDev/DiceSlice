// Fetches real astronomical objects from public scientific databases and writes
// src/planet/generatedRoster.json - the data behind the "unlimited" combat roster that
// extends the hand-tuned 66 in realPlanets.ts. Run: npm run gen:roster (network required).
//
// Sources (all public services):
//   - NASA Exoplanet Archive TAP (exoplanetarchive.ipac.caltech.edu) - confirmed exoplanets
//   - NASA/JPL Small-Body Database (ssd-api.jpl.nasa.gov) - large asteroids + numbered comets
//   - CDS SIMBAD TAP (simbad.cds.unistra.fr) - IAU-named stars (with spectral types),
//     named nebulae and galaxies
//
// The output is committed, so the app never fetches at runtime and the roster stays
// deterministic between deploys. Entries are compact: only fields the profile mapper
// (rosterGen.ts) actually uses.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'planet', 'generatedRoster.json')

// Caps keep the bundle sane (~1000 objects ≈ 60KB raw, ~15KB gzipped). Raise freely later.
const MAX_EXOPLANETS = 500
const MAX_STARS = 300
const MAX_DEEP_SKY = 60
const MAX_COMETS = 50

async function fetchText(url, label, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      if (i >= attempts) throw err
      console.warn(`${label}: attempt ${i} failed (${err.cause?.code ?? err.message}), retrying...`)
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
}

// Minimal CSV parser (handles quoted fields with commas; none of these sources emit
// embedded newlines in the columns we request).
function parseCsv(text) {
  const lines = text.trim().split('\n')
  const parse = (line) => {
    const out = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') inQ = false
        else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }
  const header = parse(lines[0].replace(/\r$/, ''))
  return lines.slice(1).map((l) => {
    const cells = parse(l.replace(/\r$/, ''))
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
  })
}

const num = (s) => (s === '' || s == null ? null : Number(s))

// ---------- NASA Exoplanet Archive ----------
async function fetchExoplanets() {
  const query = `select pl_name,pl_rade,pl_eqt,sy_dist,disc_year from ps where default_flag=1 and pl_rade is not null and sy_dist is not null order by sy_dist asc`
  const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(query)}&format=csv`
  const rows = parseCsv(await fetchText(url, 'Exoplanet Archive'))
  return rows.slice(0, MAX_EXOPLANETS).map((r) => ({
    n: r.pl_name.toUpperCase(),
    c: 'exoplanet',
    r: num(r.pl_rade), // Earth radii
    t: num(r.pl_eqt), // equilibrium temp, K (often null)
    d: num(r.sy_dist), // parsecs
    y: num(r.disc_year),
  }))
}

// ---------- JPL Small-Body Database ----------
async function fetchAsteroids() {
  const cdata = encodeURIComponent(JSON.stringify({ AND: ['diameter|GE|100'] }))
  const url = `https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,diameter&sb-kind=a&sb-cdata=${cdata}`
  const json = JSON.parse(await fetchText(url, 'JPL SBDB asteroids'))
  return json.data.map(([fullName, diameter]) => ({
    // "     4 Vesta (A807 FA)" -> "VESTA"
    n: fullName.trim().replace(/^\d+\s+/, '').replace(/\s*\(.*\)$/, '').toUpperCase(),
    c: 'asteroid',
    D: num(diameter), // km
  }))
}

async function fetchComets() {
  const url = `https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,diameter&sb-kind=c&sb-ns=n&limit=${MAX_COMETS}`
  const json = JSON.parse(await fetchText(url, 'JPL SBDB comets'))
  return json.data.map(([fullName, diameter]) => ({
    // "    1P/Halley" -> "COMET HALLEY" (designation prefix dropped for display)
    n: 'COMET ' + fullName.trim().replace(/^\d+[PDI]\//, '').toUpperCase(),
    c: 'comet',
    D: num(diameter),
  }))
}

// ---------- SIMBAD ----------
async function simbadQuery(adql, label) {
  const url = `https://simbad.cds.unistra.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=csv&query=${encodeURIComponent(adql)}`
  return parseCsv(await fetchText(url, label))
}

const stripName = (id) => id.replace(/^NAME /, '').toUpperCase()

async function fetchStars() {
  // IAU-named stars, brightest first. The otypes table includes ancestor types, so
  // otype='*' catches supergiants/dwarfs/variables too.
  const rows = await simbadQuery(
    `SELECT DISTINCT b.oid, i.id, b.sp_type, f.V AS vmag FROM ident i JOIN basic b ON i.oidref=b.oid JOIN otypes o ON o.oidref=b.oid LEFT JOIN allfluxes f ON f.oidref=b.oid WHERE i.id LIKE 'NAME %' AND o.otype='*' AND b.sp_type IS NOT NULL AND f.V IS NOT NULL ORDER BY vmag ASC`,
    'SIMBAD stars',
  )
  // One entry per physical object: SIMBAD lists several NAME aliases for the same star
  // (Rigel Kentaurus / Rigil Kentaurus share an oid) - keep the first (brightest-sorted).
  const seenOid = new Set()
  const seen = new Set()
  const out = []
  for (const r of rows) {
    // "SIRIUS A" -> "SIRIUS" (primary-component suffix reads as a dupe of the plain name;
    // B components are kept - a white dwarf companion is its own object).
    const name = stripName(r.id).replace(/ A$/, '')
    if (seenOid.has(r.oid) || seen.has(name)) continue
    seenOid.add(r.oid)
    seen.add(name)
    out.push({ n: name, c: 'star', s: r.sp_type, v: num(r.vmag) })
    if (out.length >= MAX_STARS) break
  }
  return out
}

// A "real" proper name (Ring Nebula, Sombrero...) vs survey-ese ("18234+6440",
// "AGPS 273.4-17.8"): require a word of 4+ letters and more letters than digits overall.
function isProperName(name) {
  if (name.length > 26) return false
  if (/\d\d/.test(name)) return false // multi-digit anywhere = survey/catalog designation
  if (!/[A-Z]{4,}/.test(name)) return false
  // A word with no vowel is astronomer shorthand (DSPH, CVN, LRD), not a proper name.
  return name.split(/[^A-Z]+/).every((w) => w.length < 3 || /[AEIOUY]/.test(w))
}

// Deterministic string hash - used to shuffle candidate lists so per-class caps sample
// the whole alphabet instead of stopping at the A's (SIMBAD returns rows alphabetically).
function nameHash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

async function fetchDeepSky() {
  // Named nebulae (planetary/HII/supernova remnants) and galaxies, capped per class so
  // one class can't crowd out the other.
  const rows = await simbadQuery(
    `SELECT DISTINCT b.oid, i.id, b.otype FROM ident i JOIN basic b ON i.oidref=b.oid WHERE i.id LIKE 'NAME %' AND b.otype IN ('PN','HII','SNR','G','GiG','AGN','SyG','SBG')`,
    'SIMBAD deep sky',
  )
  // One name per physical object (aliases share an oid); prefer the shortest proper name.
  const byOid = new Map()
  for (const r of rows) {
    const name = stripName(r.id)
    if (!isProperName(name)) continue
    const prev = byOid.get(r.oid)
    if (!prev || name.length < prev.name.length) byOid.set(r.oid, { name, otype: r.otype })
  }
  const candidates = [...byOid.values()].sort((a, b) => nameHash(a.name) - nameHash(b.name))
  const nebulae = []
  const galaxies = []
  for (const { name, otype } of candidates) {
    const isGalaxy = ['G', 'GiG', 'AGN', 'SyG', 'SBG'].includes(otype)
    const bucket = isGalaxy ? galaxies : nebulae
    if (bucket.length < MAX_DEEP_SKY / 2) bucket.push({ n: name, c: isGalaxy ? 'galaxy' : 'nebula' })
  }
  return [...nebulae, ...galaxies]
}

// ---------- main ----------
const [exoplanets, asteroids, comets, stars, deepSky] = await Promise.all([
  fetchExoplanets(),
  fetchAsteroids(),
  fetchComets(),
  fetchStars(),
  fetchDeepSky(),
])

const entries = [...exoplanets, ...asteroids, ...comets, ...stars, ...deepSky]

// Drop anything that clashes with a hand-tuned realPlanets.ts name (those stay canonical).
// Comparison is loose (case/space/punctuation-insensitive) to catch "TRAPPIST-1 e" vs "TRAPPIST-1E".
const norm = (n) => n.toUpperCase().replace(/[^A-Z0-9]/g, '')
const realPlanetsSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'planet', 'realPlanets.ts'), 'utf8')
const handTuned = new Set([...realPlanetsSrc.matchAll(/(?:noAtmo|terran|gas|star|blackHole|galaxy|nebula|ice|lava|rock)\(\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/g)].map((m) => norm(m[1] ?? m[2])))
// Hand-tuned objects whose roster name differs from the database designation.
const KNOWN_ALIASES = ['COMETHALLEY', 'COMETCHURYUMOVGERASIMENKO']
KNOWN_ALIASES.forEach((a) => handTuned.add(a))
const globallySeen = new Set()
const filtered = entries.filter((e) => {
  const key = norm(e.n)
  if (handTuned.has(key) || globallySeen.has(key)) return false
  globallySeen.add(key)
  return true
})

const output = {
  _meta: {
    generated: new Date().toISOString().slice(0, 10),
    sources: [
      'NASA Exoplanet Archive (exoplanetarchive.ipac.caltech.edu)',
      'NASA/JPL Small-Body Database (ssd-api.jpl.nasa.gov)',
      'CDS SIMBAD (simbad.cds.unistra.fr)',
    ],
    counts: { exoplanets: exoplanets.length, asteroids: asteroids.length, comets: comets.length, stars: stars.length, deepSky: deepSky.length },
  },
  entries: filtered,
}
writeFileSync(OUT, JSON.stringify(output))
console.log(`Wrote ${filtered.length} entries (${entries.length - filtered.length} deduped against hand-tuned roster) to ${OUT}`)
console.log(output._meta.counts)
