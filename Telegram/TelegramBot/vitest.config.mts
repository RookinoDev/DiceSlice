// Runs playerDurableObject.vitest.mjs / d1.vitest.mjs inside the real workerd runtime (via
// @cloudflare/vitest-pool-workers), so PlayerDO's SQLite storage and D1 bindings are genuinely
// exercised - not mocked - which matters because these tests rely on real atomicity properties
// (a DO's single-threaded execution, D1's single-writer serialization), not just API shape.
// node --test (cards.test.mjs, validateInitData.test.mjs, and until cutover db.test.mjs) is
// untouched by this - it has no Cloudflare bindings to exercise and stays on its own runner.
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// readD1Migrations reads the .sql files from Node (this config file's own context) - it can't
// run inside the worker sandbox that setupFiles execute in (confirmed: importing it there pulls
// in Node-only deps like chalk/miniflare that fail under workerd). `provide` hands the resulting
// plain data across that boundary; test/applyMigrations.mjs picks it up via `inject`.
const migrations = await readD1Migrations('./migrations')

export default defineConfig({
  test: {
    include: ['**/*.vitest.mjs'],
    setupFiles: ['./vitest-setup/applyMigrations.mjs'],
    provide: { d1Migrations: migrations },
  },
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
})
