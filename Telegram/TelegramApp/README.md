# Stellar Breaker — Telegram Mini App

React 19 + TypeScript + Vite port of the Stellar Breaker idle clicker (the Unity original lives in `Unity/` at the repo root). Planets are rendered with three.js using shaders ported from the PixelPlanets generator.

## Development

```bash
npm ci
npm run dev      # local dev server
npm test         # vitest suite (game core / economy)
npm run build    # type-check + production bundle in dist/
```

## Deployment

Deployed to Cloudflare Pages at https://stellar-breaker.pages.dev (project `stellar-breaker`, direct upload — not git-connected).

Pushes to `main` that touch this folder deploy automatically via GitHub Actions (`.github/workflows/deploy-telegram-app.yml`); it needs the `CLOUDFLARE_API_TOKEN` repo secret (Cloudflare token with Pages: Edit). Manual deploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name stellar-breaker
```

## Structure

- `src/game/` — game core, a 1:1 port of the Unity C# (`Config`, `Core`, `Economy`, `Gameplay`, `Monetization`, `Persistence`). Balance lives in `src/game/config/BalanceConfig.ts`.
- `src/ui/` — React shell: screens, sheets, and the juice hooks (screen shake, tap streaks, floating numbers, particles).
- `src/planet/` — three.js planet canvas + GLSL shaders.
- `src/telegram.ts` — Telegram WebApp SDK glue.

The companion bot/backend (grammY + Stars payments) is in `../TelegramBot`.
