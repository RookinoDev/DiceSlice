# Fleet "Siege Orbit" — Combat-Screen Fleet Visualization Plan

Status: **approved, ready to build** · Target: `Telegram/TelegramApp` only (web app; Unity is paused/out of scope). This doc exists so any machine (home or work PC) can pick the work up cold — check `git log` first: a scheduled run may already have implemented part or all of it.

Owned ships appear as sprites orbiting the current planet on the combat screen and visibly fire at it, driven by REAL game events. Strictly cosmetic — nothing here may write to damage, rewards, cooldowns, or any gameplay value.

## Building blocks already in the codebase

- `ShipService` (`src/game/gameplay/ShipService.ts`): `onShipHit` emitter fires `{ index, damage }` for **every real ship shot** (cooldown-based hits, not silent DPS) — all firing visuals ride this. `onShipChanged` (level 1 = newly acquired → warp-in). `isOwned/levelOf/def/cooldown`.
- `src/ui/shipTierVisuals.ts`: 6-tier clip-path silhouettes + tier colors = the **placeholder art**. Real ship art comes later from the user — isolate rendering in ONE sprite component (e.g. `FleetShipSprite`) so art swaps in a single place.
- `src/ui/combatFx/useParticles.ts` + `ParticleLayer` for projectiles/impacts; planet impulse API (`PlanetCanvas` `onReady`) for heavy-hit kicks; `vm.bossActive` / `vm.bossSecondsLeft` for formations.

## Requirements

1. **Orbiting fleet**: one sprite per owned ship type, visible cap ~8 (prefer highest tiers). Elliptical orbits (Y squashed ~0.35×), per-ship radius/speed/phase. Fake 3D: top arc renders behind the planet canvas (smaller, dimmed, lower z-index), bottom arc in front — flip at crossings. One shared rAF loop writing transforms to refs directly (no React state per frame — `useCountUp.ts` philosophy).
2. **Per-ship particle identity** (explicit user requirement): each of the 19 ships gets a DISTINCT projectile style derived from its real `ShipDefinition.ts` name, archetype/behavior, and baseCooldown — fast/light = thin rapid darts; mid = paired pulses / arcs / shard bursts; slow/heavy = big glowing orbs or beams with impact flash, small planet impulse, faint shake for the heaviest. Name informs flavor (mining-flavored → shards, lance/beam-named → line beam, …). Tier color = base palette; shape/size/count/trail differentiate. Shape: a data table `shipIndex → particle spec` in one file.
3. **Firing**: on `onShipHit`, sprite recoils + muzzle flash at its current orbital position, projectile travels to a planet point, small impact flash. Global visual cap ~8 projectiles/sec — skip visuals over the cap, never anything else.
4. **Moments**: warp-in streak on first acquisition (combat tab); boss siege formation (wider/flatter/slower while `bossActive`, tighter + faster-looking in the final 10 s); celebratory flyby on `onReward`.
5. **`prefers-reduced-motion: reduce`**: static parked ships, no projectiles, no flyby.

## Verification pattern (project standard)

`tsc -b` → `vitest run` → production build → live preview check (launch config `telegram-app-dev`, port 5173; use eval/inspect measurements, screenshots are unreliable) → commit (no push/deploy without the user; Cloudflare deploys need their API token, provided per-session in chat).

Known quirk: rapid edits can make Vite emit FALSE "React hooks order changed" errors — restart the dev server before believing them.
