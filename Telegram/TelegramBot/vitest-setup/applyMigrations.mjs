// vitest-pool-workers gives each test file its own isolated D1 instance but does NOT auto-apply
// migrations/0001_init.sql to it (confirmed empirically - every table-touching test failed with
// "no such table" until this ran). This file executes INSIDE the worker sandbox (that's how it
// gets a real `env.DB`), so it receives the already-parsed migrations from vitest.config.mts's
// `provide` rather than reading the .sql files itself - readD1Migrations is a Node-side utility
// that fails if imported from in here (see vitest.config.mts's comment for what that looks like).
import { applyD1Migrations, env } from 'cloudflare:test'
import { inject } from 'vitest'

await applyD1Migrations(env.DB, inject('d1Migrations'))
