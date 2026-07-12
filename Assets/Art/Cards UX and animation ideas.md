# Cards page + card/pack animation — ideas to pick from

Notes for the next pass. Nothing here is implemented yet — pick what you like, cut the rest, and hand it back.

---

## The core problem, as I see it

The visual direction for cards (the assets you've been sending) is calm: pastel, iridescent, gold linework, soft glow, museum-piece energy. The *interaction* direction that got built over past sessions leaned hard into a different reference — Balatro: underdamped springs with overshoot/wobble, screen-shake-adjacent particle bursts, spinning god-rays, escalating haptics, multiple things animating at once even at rest (ultra sparkle text drifting, frame iridescence cycling every 5s, holo idle-orbit, foil sheen looping).

Those two directions fight each other. A soft pastel collectible reads as premium when it's *still* most of the time and has one clean moment of motion when it matters. Right now almost everything moves all the time, which reads as busy/cheap regardless of how nice the art is. "Minimal juice" probably means picking the calmer direction and cutting hard.

---

## 1. Collection (cards) page — layout/UX

**What's there now:** a search box, then 3 full rows of filter chips (7 rarity + 7 type + ~8 variant/favs/dupes), then 6 sort buttons — roughly 25+ tappable chips visible before you've even looked at a card. On a phone that's a wall of controls above the fold.

Ideas, roughly ordered by impact:

- **Collapse filters behind one button.** A single "Filters" pill (with a small count badge when active, e.g. "FILTERS · 2") that opens a sheet with rarity/type/variant/favs/dupes grouped inside. Sort becomes a single dropdown/select, not 6 buttons. The main screen goes back to: search bar, one filter button, the grid. That alone probably fixes most of the "too much" feeling.
- **Bigger cards, fewer columns.** 3 columns of small cards forces tiny text/icons (gem at 11px, name truncated). Consider 2 columns with more room per card — read as more premium, matches the "card size should look like the reference" note from before.
- **Tabs instead of chips for the big split.** If "favorites" and "missing/owned" are the two things people actually reach for, make those tabs at the top, and push rarity/type/variant into the filter sheet instead of flattening everything to the same row of chips.
- **Progressive complexity.** Someone with 8 cards doesn't need the same filter UI as someone with 3,000. Hide the filter button (or the whole search bar) until the collection passes some size threshold — small collections just show the grid.
- **Consistent empty/locked state** — worth a once-over so "no cards yet" and "no filter matches" don't look like the same generic message.

---

## 2. Animation / "juice" — dial it back

Everything below is about *removing* motion, not adding it. Suggested rule: **one signature effect per moment, nothing ambient unless the card is actually being touched.**

**Card detail view (the flip card):**
- Drop the overshoot/wobble spring for something that arrives clean — still has a little life (a fast ease-out with the tiniest settle), not a bouncy toy.
- Cut the squash-on-flip kick, or make it barely perceptible. A flip doesn't need a bounce landing.
- Ambient effects currently stacked at rest: legendary edge-pulse glow (loops forever), ultra sparkle text drifting above the card (loops forever), ultra frame iridescence cycling (5s loop, forever), holo idle light-orbit (drifts forever when untouched). That's four independent infinite loops on one card before you've touched it. Pick **one** — probably just the frame material read (metal vs. gold vs. iridescent) doing nothing extra, full stop. Motion should only kick in when the player drags/tilts it.
- Rare-card entry currently spawns a 14-particle debris burst around the card on open. Consider replacing with a single soft glow pulse (scale 0.96→1 + brightness flash, no particles) — reads as "special" without the fireworks.

**Pack opening:**
- Current sequence: hold-to-tear (escalating haptic + shake) → burst flash + shockwave → cards fly in face-down with idle drift → tap flips top card with squash-land → epic+ gets screen dim/spotlight → legendary+ gets a silence beat then boom+shockwave → ultra gets converging constellation lines → recap screen. That's 5+ distinct "big moments" stacked in one flow.
- Suggest cutting to: tear (small haptic, no shake) → cards appear face-down (no idle drift wiggle) → tap flips each card with a clean flip + soft light sweep, color intensity of that sweep scaling with rarity (common = barely there, ultra = a clear but still *single* moment, not stacked stagewide effects) → simple recap.
- Kill the constant idle drift/wobble on the dealt pile and the dust-drift background — a still pile of cards you tap through reads calmer and lets the one flip motion actually stand out.

**General:**
- One small shared easing set (e.g. a quick ease-out for entrances, a slightly softer one for exits) instead of a different cubic-bezier per component — makes everything feel like one system instead of a pile of separate effects.
- Haptics: reserve the stronger ones (success/prestige-tier) for genuinely rare pulls; everything else gets a light tap or nothing.

---

## Rough prioritization if only doing a few things

1. Collapse the filter chips into one button + sheet (biggest single UX fix).
2. Remove ambient/looping animations on cards at rest — keep motion tied to actual touch or a single reveal moment.
3. Simplify the pack-opening sequence to one clean flip beat instead of a five-stage escalation.
4. Bigger cards / fewer columns in the grid, if there's room after (1).
