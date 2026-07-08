# Stellar Breaker — Collectible Card Ecosystem: Master Plan

Status: **design approved-pending** · Lead platform: **Telegram Mini App** (React/TS/three.js) + **TelegramBot backend** (Node/SQLite on Railway) · Unity remains the mirror for the game core only.

Guiding principle (from the product owner): every mechanic must reinforce that players are building a **valuable, long-term collection of real astronomical objects** — not unlocking cosmetics. Design consequences used throughout:

1. **Server-authoritative inventory.** The moment cards are tradable and touch Telegram Stars, they are valuables. Cards do NOT live in the localStorage/cloud save blob; they live in their own server-side inventory with atomic grants (same discipline as the `purchases` table).
2. **Serial-numbered instances.** Every card pulled is an instance with a global mint number per (card, variant): "BETELGEUSE · Holo · Mint #0042". This is nearly free to implement (a counter per card) and is the single cheapest source of premium collectible feeling and trade value differentiation.
3. **Procedural art is the pipeline.** The card artwork IS the shader-rendered object from `realPlanets.ts`. We never commission static planet art; we invest in shaders and frames. Art scales with code, stays consistent, and the "click the object → live 3D viewer" feature falls out naturally because the artwork was never a picture in the first place.
4. **The existing phase rule holds.** Pack drops attach to boss-kill *events* (additive rewards); combat and economy balance logic is untouched.

---

## 1. Improving Procedurally Generated Celestial Objects

### Current state
Six shader kinds (noAtmosphere, terranWet, gasGiant, iceWorld, lavaWorld, asteroid) + the new nebula kind; 66 deterministic real objects in `realPlanets.ts`; quad-stack orthographic rendering in `PlanetCanvas.tsx`.

### Techniques to add (ordered by wow-per-cost)

| Technique | What it does | Cost |
|---|---|---|
| **Atmospheric fresnel rim** | Soft glow hugging the limb, color per object (Earth cyan, Mars thin dust-pink, Titan orange). One additive layer, SDF falloff from sphere edge. | Low |
| **Signature features layer** | THE answer to "unique while real": a per-object decal layer for landmarks science people recognize — Jupiter's Great Red Spot (anchored anticyclone vortex in the gas shader), Pluto's Tombaugh Regio heart, Enceladus tiger stripes, Iapetus equatorial ridge, Mars' Valles Marineris scar, Saturn's hexagonal pole (visible at high tilt in viewer). Data-driven: `features: [{type: 'spot', lat, lon, scale, colors}]` on the profile. | Medium |
| **Star corona + limb flares** | Stars get a soft corona halo (radial gradient billboard) + occasional prominence arcs (curl-noise particle wisps). Proxima/UY Scuti get flare bursts on a timer. | Low-Med |
| **Comet tails** | Reuse the existing particle system: ion tail (straight, blue) + dust tail (curved, warm) streaming opposite the light origin. Only for comet-class objects. | Low |
| **Pulsar lighthouse** | Periodic beam sweep + global brightness pulse (one uniform driven at the real-ish period, slowed to ~1s for readability). | Low |
| **Black hole lensing** | Screen-space distortion ring: render the starfield behind into a small RT, refract around the shadow. The single biggest "screenshot this" effect in the game. Fallback (low-end): static warped-starfield sprite behind the disk. | High |
| **Night-side detail** | Terran worlds: faint city lights only for Earth (it's the one place we know has them) — instantly tells players we care about real characteristics. | Low |
| **Aurora caps** | Subtle animated curtain noise at poles for magnetized worlds (Earth, Jupiter, Saturn). | Medium |
| **Selective bloom** | Skip full-screen UnrealBloom (mobile cost); fake it with pre-blurred additive halo layers on emissive objects (stars, lava, accretion disks). | Low |
| **Per-class color grading** | A final tint/contrast uniform per region (inner system warm, Kuiper cold, deep sky purple) so screenshots from different progression depths look like different "biomes". | Low |

### Avoiding repetition
- Repetition today comes from roster cycling, not randomness. Fixes: (a) keep growing the roster via sets (§9); (b) "observation variants" — the same object re-encountered in a later cycle gets a different light angle + phase (crescent/gibbous lighting) so MARS on cycle 3 reads as a new observation of a familiar world, which is thematically honest; (c) signature features make each headline object unmistakable.
- Never vary the *identity* traits (Mars stays rust; Neptune stays deep blue). Vary presentation only: light origin, phase, starting rotation, zoom.

### Shader inventory to build (web GLSL first, Shader Graph ports later)
1. `rimAtmosphere.ts` — fresnel glow, per-object color/width.
2. `featureDecal.ts` — lat/lon-anchored spot/streak/patch stamped in surface space (rotates with the body).
3. `corona.ts` — star halo + animated prominence noise.
4. `lensing.ts` — black-hole background refraction (RT-based, gated by device tier).
5. `cometTail.ts` — particle material with light-origin-aware emission direction.
6. Upgrades to `gasLayers` — vortex injection (Great Red Spot), pole hexagon mask.

---

## 2. Card Artwork Pipeline

Card proportions: real TCG ratio 63:88. Master size **660×920 CSS px** (rendered @2x = 1320×1840 on retina). All chrome is **SVG/CSS-first** (crisp at any size, ~KB not MB); raster only for noise/foil masks (tileable 512×512 PNGs) and pre-rendered artwork thumbnails.

Visual style: extends the existing design system (`index.css` tokens — deep navy `#0a0d18`, gold/cyan/magenta accents, Rajdhani display + Sora body). The card should look like an instrument from the same ship as the rest of the UI: scientific, dark, precise — "NASA mission patch meets premium TCG".

### Asset manifest

| Asset | Purpose | Style | Resolution/Format | Layers | Animation |
|---|---|---|---|---|---|
| **Card frame ×6 rarities** | Instant rarity read at grid size | Common: flat gunmetal line frame → Ultra: layered gold/iridescent filigree with corner "instrument brackets" | SVG (one file, 6 theme variants via CSS vars) | border, corner ornaments, name plate, class chip, bottom data plate | Epic+: slow 8s sheen sweep (CSS gradient) |
| **Artwork window** | The object itself | Live shader render (focused view) / pre-rendered PNG thumb (grid) | thumbs 330×330 @2x WebP, generated on device & cached in IndexedDB | starfield backdrop, object render, feature glints | Focused card: fully live |
| **Starfield backdrops ×6 regions** | Depth + region identity behind the object | Sparse pixel stars + faint region-tinted nebulosity | 1024×1408 WebP, heavily compressible | 2 parallax star layers + tint wash | Parallax on card tilt (transform only) |
| **Rarity gems** | Collection-number line icon | Faceted gem silhouette per tier, tier color | SVG, 24px design size | single | Legendary+: 2s twinkle |
| **Class icons ×10** | Planet/moon/star/nebula/galaxy/black hole/comet/asteroid/exoplanet/dwarf | Single-weight line icons matching existing `icons.svg` | SVG sprite | single | none |
| **Scientific data plate** | Physical characteristics table (mass, radius, temp, distance) | Thin mono-spaced readout rows, hairline dividers, "instrument label" typography | CSS/HTML (not an image) | n/a | count-up on first reveal |
| **Holo overlay masks ×4 patterns** | Foil patterns (§3) | linear rainbow / radial burst / cosmos speckle / galaxy swirl | 512×512 tileable PNG (R=pattern, G=sparkle sites, B=depth) | packed mask | driven by shader |
| **Card back** | Universal back, must be iconic | Stellar Breaker emblem (stylized cracked planet), constellation lines, set-agnostic | SVG + noise PNG | emblem, ring text, star specks | subtle 12s star drift |
| **Pack wrappers ×4 types** | Pack inventory + opening object | Foil pouch look per pack tier, window showing region art | SVG frame + WebP art 512×704 | wrapper, seal, tier ribbon | idle shimmer; tear state |
| **Pack-opening VFX kit** | The ceremony | beam-of-light, particle burst (reuse combatFx system), shockwave ring, screen-edge vignette | particle sprites 64×64 sheet | n/a | scripted sequence (§4) |
| **Collection UI chrome** | Grid cells, filter chips, set banners, progress rings | Existing sheet/panel tokens | CSS | n/a | standard transitions |
| **Ghost card silhouettes** | Un-owned cards in collection | Dark silhouette of object class + "???" | generated (CSS filter on class icon) | n/a | none |
| **Mint plate** | Serial number strip | Embossed mono numerals "Nº 0042" | CSS | n/a | stamp-in on first reveal |

Pipeline rule: **no asset without a generator or a source SVG in the repo.** Everything reproducible; nothing lives only in an export.

---

## 3. Holographic Card System

### Architecture (web)
Two tiers, chosen by context + device capability:

1. **Grid/browsing tier — CSS holo.** Pure CSS: layered `background-blend-mode` rainbow gradient + pattern mask, driven by CSS vars `--tilt-x/--tilt-y`. Cheap enough for a dozen visible cards. No WebGL.
2. **Focused-card tier — WebGL holo.** One fullscreen-card quad shader (a second small three.js scene, or the same context as the object render). This is where we beat Pokémon:
   - **Inputs:** normalized pointer/gyro light vector, time, rarity params, packed pattern mask (R=foil pattern, G=sparkle sites, B=depth map).
   - **Rainbow foil:** `hue = dot(lightVec, uv-warp) * frequency + patternMask.r`; HSV→RGB ramped, masked to foil regions, added with soft-light blend.
   - **Moving reflections:** two broad specular bands sweeping with tilt at different rates (fake dual-layer lamination).
   - **Sparkle glints:** G-channel sites pop when `abs(sin(hash(site)+lightAngle))` crosses a threshold — discrete twinkles, not uniform glitter.
   - **Depth illusion:** B-channel drives a 2–6px parallax shift between artwork/frame/foil layers against tilt (the "layers inside the card" feel).
   - **Edge highlight:** SDF border distance → thin bright rim that chases the light around the card edge.
   - **Reveal glint:** scripted diagonal flash used once at pack-reveal.

**Tilt input:** Telegram Mini App `DeviceOrientation` (Bot API 8.0) when available → gyro-driven holo (the killer phone feel: tilt the phone, the foil moves). Fallbacks: touch-drag, then autopilot slow orbit (desktop idle).

### Rarity → holo style mapping
| Tier | Foil coverage | Pattern | Extra |
|---|---|---|---|
| Common/Uncommon | none (Holo variant only) | — | — |
| Rare | name plate + gem | linear rainbow | — |
| Epic | frame filigree | radial burst | sheen sweep |
| Legendary | full-art foil | cosmos speckle | sparkle glints + edge chase |
| Ultra Rare | full card | galaxy swirl (animated mask scroll) | parallax depth + idle particles + unique reveal |
| **Holographic variant (any tier)** | artwork window | tier pattern at 2× intensity | mint plate turns iridescent |

### Performance budget (mobile)
- Only ONE WebGL holo card alive at a time (the focused card). Grid uses CSS tier.
- Shader ≤ ~40 ALU ops, single texture fetch (packed mask), no branches.
- Gyro events throttled to rAF; CSS vars updated via `style.setProperty` on one element.
- Device tiering: `navigator.hardwareConcurrency`/GPU heuristic; low tier gets CSS holo everywhere (still pretty) and no lensing.

### Unity mapping
Same math in Shader Graph: pattern mask texture, `_LightVec` from gyro (`Input.gyro.attitude`) or mouse, HSV ramp node group, SDF edge from a distance-field border texture. One material, per-rarity keyword variants.

---

## 4. Card Pack System

### Pack types (mapped to the boss escalation already in `realPlanets.ts`)
| Pack | Source bosses | Cards | Guarantees |
|---|---|---|---|
| **Meteor Pack** | Giants (boss #1–10) | 3 | ≥1 Uncommon |
| **Stellar Pack** | Stars (#11–20) | 4 | ≥1 Rare |
| **Deep Sky Pack** | Nebulae/galaxies (#21–28) | 5 | ≥1 Epic |
| **Singularity Pack** | Black holes (#29–30) | 5 | ≥1 Legendary, holo odds ×3 |

Boss reward scaling beyond type: pack *quality score* = boss index + prestige cycle depth → later cycles upgrade slot odds (never the guarantee floor — floors stay legible).

### Drop tables (launch values, tune with data)
Per non-guaranteed slot: Common 55% · Uncommon 25% · Rare 12% · Epic 5.5% · Legendary 2% · Ultra 0.5%. Holographic roll per card: 5% (15% in Singularity). **Pity (server-tracked):** Epic+ within 10 packs, Legendary+ within 30, Ultra within 150. All odds **published in-game** (§ risks).

### Server authority
The server rolls everything. Client calls `POST /api/packs/open` → server: verifies pack ownership → rolls slots → mints instances (serials assigned atomically) → returns contents. The client only *animates* what the server already decided. Pack *earning* is derived server-side from cloud-save deltas (boss stages crossed since last sync) + rate sanity caps — imperfect against save forgery (client-authoritative idle game), but centralized in one auditable place.

### Duplicate handling
Duplicates auto-convert **only when the player chooses** (never silently — collectors keep dupes for trading): "Refine" a dupe → **Prism Dust** (5/15/40/100/250/600 by tier; holo ×4). Dust crafts a chosen missing card at ~4× its refine value = deterministic bad-luck protection and a long-term sink.

### The opening ceremony (suspense choreography)
1. Pack floats on starfield, gyro-reactive shimmer. Hold-to-tear (haptic ramp during hold — `impactOccurred` escalating).
2. Tear → burst particles + light beam; cards fan out face-down.
3. Swipe each card to flip. **Rarity tell before the flip:** card-back edge glow color hints tier (collectors learn to read it — the "next card is glowing gold" moment IS the product).
4. Epic+: screen dims, time slows, single spotlight; Legendary+: silence beat → boom + shockwave; Ultra: constellation lines converge into the card before it flips.
5. New-card badge, mint number stamp-in, dust total for dupes, "best pull" recap screen with a share button (Telegram share → referral loop).

Sound: paper-foil tear, rising shimmer pitch per tier, sub-bass hit for Legendary, and a signature 3-note motif for Ultra (players will Pavlov on it). All through existing `AudioManager`.

### Future monetization hooks (design now, ship later)
- Pack SKUs sellable for Stars later (same server pipeline, `source: 'purchase'`).
- Subscription (§7) grants a weekly Deep Sky pack + holo-odds boost.
- Event packs with restricted card pools (§9).
- **Never** sell Ultra-guaranteed packs; monetize *access and cadence*, not outcomes.

---

## 5. Interactive Card Viewer

Gesture spec (mobile-first):
- **Drag** → 3D tilt (CSS `perspective` + `rotateX/Y`, spring-back on release; drives holo light vector).
- **Tap flip** → card back (universal back design). Extended info lives on a pull-up sheet, not the back.
- **Pinch** → zoom into artwork (transform-origin at pinch center, up to 3×; holo stays live).
- **Tap the object in the artwork** → the card "opens": artwork window expands fullscreen into the **live object viewer** — the same `PlanetCanvas` profile, now with orbit controls (drag = rotation ± axis tilt, pinch = dolly), the real starfield backdrop, and the object's signature features annotated.
- **In the viewer:** floating **fact chips** anchored to features (tap the Great Red Spot → "a storm larger than Earth, raging ≥300 years"). A "SCAN" button sweeps a scanline across the object and reveals the physical characteristics as instrument readouts (mass, radius, temp, distance — animated count-ups). This is the "learn through an immersive viewer, not a text dump" requirement.
- Card metadata shown: name, classification, collection number (SOL-023/066), rarity gem, mint number, set emblem, flavor description, discovery/history line (when applicable: "First photographed object of its kind — Event Horizon Telescope, 2019").

Implementation notes: card tilt is pure CSS (no WebGL needed until focus); the object viewer reuses the existing lazy-loaded three.js chunk; `uRotation` is already a uniform — orbit control maps drag→rotation velocity with inertia. Add a `uTilt` (axis inclination) uniform so the viewer can show poles (needed for Saturn hexagon / aurora payoff).

---

## 6. Collection System

- **Home:** set tabs (Set 1: The Solar Neighborhood…), each a virtualized grid (windowed rendering — thousands of cards at 60fps; only CSS-tier holo in grid).
- **Filters:** class (10), rarity (6), owned/missing/holo-only/dupes-only; **search** by name; **sort** by collection №, rarity, newest, mint №, A–Z.
- **Ghost slots** for missing cards show silhouette + acquisition hint ("Drops from star-class bosses · craftable for 160 dust"). Missing cards must feel *locatable*, not random.
- **Favorites:** heart any card; favorites pin to profile showcase (3 slots).
- **Completion:** per-set progress ring + rewards at 25/50/75/100% (dust, pack, exclusive card back, title; 100% = commemorative trophy card, itself collectible, non-tradable).
- **Stats panel:** total cards, holo count, rarest pull, lowest mint owned, completion %, dust balance, packs opened, luck index (fun stat: your Ultra rate vs expected).
- **Showcase:** the seed of Profiles — public view (via `t.me` deep link) rendering showcase slots + stats. Ships read-only first; full profiles later.

---

## 7. Trading System (future update — designed now so nothing blocks it)

**Model: instance-transfer with server escrow.** Because every card is a serial-numbered instance with an `owner_id`, a trade is one SQL transaction flipping ownership rows — anti-duplication is structural, not procedural.

- **Flow:** initiate → offer builder (both sides see exact instances incl. mint numbers) → both press CONFIRM → 5-second mutual cancel window → server executes atomically → both notified via bot message. No partial states ever visible.
- **Subscription ("Observatory Pass", Telegram Stars monthly subscription):** unlocks trading; N free trades/month; beyond that, trades cost Stardust (in-game sink) — event rules can set free-trade windows for everyone.
- **Stars in trades:** Stars act as a **trade service fee** paid to the game, never as a P2P payout for cards (a player-to-player Stars marketplace = real-money trading with heavy policy/regulatory weight; revisit only via Telegram-native gift infrastructure).
- **Anti-scam:** value-mismatch warning ("you are giving significantly more than you receive"), mandatory review screen with card zoom, per-day trade caps, account gates (min level + account age + completed cloud-save history), cooldown on newly received cards (24h re-trade lock — kills laundering loops), full immutable `trade_log` for support.
- **Anti-abuse economics:** trade tax in Stardust (sink), no card→currency sellback to the game above dust rates, monitoring query for circular-trade farming patterns.
- **Trade history:** every card's detail view shows provenance ("Pulled by @user Jan 2027 · traded 2×") — provenance makes instances feel like objects with a life, which is premium-collectible psychology.

---

## 8. Technical Architecture

### Data model (catalog vs inventory — never mixed)
- **Card catalog** = versioned data in the app bundle (like `realPlanets.ts`): `CardDefinition { id, setId, collectionNo, name, classification, rarity, holoAvailable, profileRef, features[], facts[], physical{...}, discovery?, flavor }`. `profileRef` points into the existing profile system — cards and combat share one visual source of truth.
- **Inventory** = server truth: 
  - `card_instances(id, card_id, variant, serial, owner_id, source, minted_at)` (+ unique index on `(card_id, variant, serial)`)
  - `card_serial_counters(card_id, variant, next_serial)`
  - `packs(id, owner_id, type, quality, source, opened_at)`
  - `pity_counters(owner_id, tier, count)`
  - `trades(id, a_id, b_id, state, created_at, executed_at)` + `trade_items`
  - `subscriptions(owner_id, tier, expires_at, star_sub_id)`
- **API:** `/api/collection` (paged), `/api/packs`, `/api/packs/open`, `/api/cards/refine`, `/api/cards/craft`, `/api/trade/*`, `/api/profile/:id` — all behind the existing initData validation; SQLite `BEGIN IMMEDIATE` transactions (the `claimPurchases` pattern generalizes).
- **Client cache:** collection mirrored to IndexedDB for instant loads + offline browsing; server is truth on reconnect. The game *save* stays exactly as-is — the two systems only touch at "save sync reveals boss kills → server issues packs".

### Asset & performance strategy (web "Addressables")
- Dynamic-import per feature (card viewer, pack ceremony) — extend the existing PlanetCanvas chunk-splitting pattern.
- Artwork thumbnails: rendered once on device (offscreen canvas → WebP blob → IndexedDB), regenerated on catalog version bump. No thumbnail CDN needed until sets get huge.
- One shared WebGL context for object renders; one for the focused holo card; hard cap two.
- Virtualized grids; masks/atlases lazy-fetched per set.
- Memory: dispose object viewer scene on close (pattern already in `PlanetCanvas` cleanup); LRU the thumb cache (~30MB cap).

### Unity mapping (when/if the card system ports)
`CardDefinition` ⇒ ScriptableObjects generated from the same JSON catalog (single source of truth, code-generated — no hand-sync). Addressables groups per set for masks/atlases; holo = one shader with per-rarity keywords; inventory via the same HTTP API (server stays the only truth). **Decision: the card system is web-led; Unity port is optional and never blocks a web release.**

### Scalability honesty
SQLite on one Railway node is fine to ~tens of thousands of players. The schema above ports to Postgres mechanically (the escape hatch when needed). The real scaling risk is not storage — it's the pack-earning trust model (client-authoritative progress). Mitigations: server-derived earning, rate caps, anomaly flags, and accepting that a single-player idle game tolerates soft cheating until trading ships — **trading is the hard trust boundary; gate it on account health checks.**

---

## 9. Long-Term Content Strategy

- **Sets (quarterly):** Set 1 *The Solar Neighborhood* (existing 66 + ~40 fills). Set 2 *The Messier Objects* (M1–M110 — a real catalog IS a trading-card checklist; deep-sky heavy). Set 3 *Exoplanet Frontier* (Kepler/TESS/JWST worlds). Set 4 *The Constellation Atlas* (bright named stars by constellation, sub-set completion per constellation). Mission sets: *Voyager's Journey*, *Eyes of JWST* (objects as imaged by specific missions — same object, new observation card).
- **Real-sky calendar events:** Perseids week → meteor-shower packs with comet/asteroid bias; real eclipse dates → one-time commemorative cards ("Total Solar Eclipse — April 2027", date-stamped, never reprinted); comet apparitions (e.g. a bright new comet) → 2-week limited card. Date-stamped limiteds are the strongest "valuable collection" signal available — schedule them from real astronomy calendars, which also markets the science.
- **Community goals:** global damage events ("the network destroys Betelgeuse 1M times this week") → everyone gets the commemorative holo; leaderboard toppers get low mint numbers (mint #1–100 by rank — brutal, brilliant).
- **Collaborations:** ESA/NASA imagery is public domain — "as imaged by Hubble" observation variants are legally clean; science-communicator promo cards (creator picks an object, signed flavor text) are cheap, high-reach partnerships.
- **Achievements → trophy cards:** milestones mint non-tradable trophy cards (First Prestige, Sector 500, 100-day streak) that live in the same collection UI — the achievement system and collection reinforce each other.
- **Daily loop:** Object of the Day (2× drop odds + spotlight facts — a daily reason to open the app that teaches astronomy), daily free mini-pack at streak milestones (feeds the existing daily-reward system), weekly "observation log" missions (defeat 3 star-class bosses → Stellar Pack).

---

## Critical Review (director's cut)

**Weaknesses & risks, ranked:**
1. **Loot-box optics** (highest reputational risk). Mitigations are non-negotiable launch features, not later polish: published odds in-game, hard pity, dust crafting (every card deterministically reachable), no pack purchases at launch (earn-first economy), age-appropriate framing. Revisit paid packs only after the earned economy proves out.
2. **Client-authoritative progress feeding a real-value economy.** Soft-cheat tolerance ends when trading starts. The plan gates trading behind subscription + account-health heuristics and keeps all mints server-side, but a determined save-forger can still farm packs. Accept for launch; log everything; build the anomaly report before the trading update, not after.
3. **Scope.** This is 4+ update arcs, not one. Cut lines are drawn: Phase 1 (catalog, inventory, packs earn/open, collection grid, card detail with tilt+flip), Phase 2 (holo shaders, object viewer, signature features), Phase 3 (profiles, set rewards, events), Phase 4 (subscription, trading). Each phase ships standalone value.
4. **Fact-content quality.** Hundreds of cards × facts/discovery text = a real editorial workload, and wrong science on an "educational" product is brand damage. Process: facts drafted with sources, checked against NASA/ESA fact sheets, stored with a `sourceUrl` field; no card ships with unsourced claims.
5. **Two sources of truth** (save blob vs card inventory) will confuse future contributors. Mitigate with an architecture note in the repo (this document) and strict rule: cards never in SaveState, progression never in inventory.
6. **WebGL perf on cheap Androids.** Device tiering + CSS-holo fallback is designed in; test on a real low-end device before Phase 2 ships.
7. **Stars/subscription policy risk.** Stars-as-fee (not P2P payouts) keeps us inside Telegram's rails; monthly Stars subscriptions are natively supported. Keep all trading value flows auditable.
8. **Repetition at extreme depth** (roster cycles). Observation variants + set growth address it; monitor sector-depth telemetry.

**What makes it premium rather than "another card feature":** serial mints with provenance, gyro-driven holo, the artwork being *alive* (click through to the real 3D object with annotated science), date-stamped real-event cards, and restraint in monetization. The product is "a natural history collection of the universe" — every design choice should pass that test.
