// One-time Railway -> Cloudflare data migration endpoint (Phase 3 of the plan). Consumes exactly
// what scripts/exportRailwaySqlite.mjs produces and replays it: the global card serial ticker
// and referrals go straight into D1, everything else per-user goes into that user's PlayerDO via
// importLegacyState (see its comment in playerDurableObject.mjs for why serials are replayed
// verbatim instead of reallocated). Guarded by a secret header, not initData - there's no
// Telegram user behind this call, it's a one-time operator action.
//
// SECURITY: this must be removed (or ADMIN_IMPORT_SECRET rotated to garbage) immediately after
// the real migration runs - a standing secret-guarded "write arbitrary data into any player's
// storage" endpoint is a liability to leave live indefinitely.
import { callPlayerDO } from './playerDurableObject.mjs'
import { syncLeaderboardStats, upsertProfileIdentity } from './d1.mjs'

export async function handleAdminImport(request, env) {
  if (request.method !== 'POST') return new Response(null, { status: 404 })
  if (!env.ADMIN_IMPORT_SECRET || request.headers.get('x-admin-import-secret') !== env.ADMIN_IMPORT_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { referrals, cardCounters, players } = await request.json()

  // Seed the global serial ticker BEFORE any per-user import - future allocateSerials() calls
  // (openPack/craftCard) must continue from these exact next_serial values. MAX() guards against
  // re-running this import regressing a counter that's already moved past the export's snapshot.
  for (const c of cardCounters ?? []) {
    await env.DB.prepare(
      `INSERT INTO card_counters_v (card_id, variant, next_serial) VALUES (?, ?, ?)
         ON CONFLICT(card_id, variant) DO UPDATE SET next_serial = MAX(next_serial, excluded.next_serial)`,
    )
      .bind(c.card_id, c.variant, c.next_serial)
      .run()
  }

  for (const r of referrals ?? []) {
    await env.DB.prepare('INSERT OR IGNORE INTO referrals (referred_user_id, referrer_user_id, created_at) VALUES (?, ?, ?)')
      .bind(r.referred_user_id, r.referrer_user_id, r.created_at)
      .run()
  }

  let imported = 0
  const errors = []
  for (const [telegramUserIdStr, playerData] of Object.entries(players ?? {})) {
    const telegramUserId = Number(telegramUserIdStr)
    try {
      await callPlayerDO(env, telegramUserId, 'import-legacy-state', playerData)

      // Seed the leaderboard index too, mirroring what a normal syncSave does - otherwise an
      // imported player wouldn't show up on the leaderboard until their next real save sync.
      if (playerData.save) {
        const save = JSON.parse(playerData.save.saveJson)
        await upsertProfileIdentity(env, telegramUserId, {
          firstName: playerData.profile?.first_name,
          username: playerData.profile?.username,
          photoUrl: playerData.profile?.photo_url,
        })
        await syncLeaderboardStats(env, telegramUserId, {
          deepestStage: save?.stats?.deepestStage ?? save?.highestStage ?? 0,
          bossesDefeated: save?.stats?.bossesDefeated ?? 0,
          prestigeCount: save?.stats?.prestigeCount ?? 0,
          deepestBossCleared: save?.stats?.deepestBossCleared ?? 0,
        })
        // Carry over the real saves_updated_at from the export so a long-idle imported player
        // isn't treated as "just synced" by the re-engagement scan.
        await env.DB.prepare('UPDATE player_index SET saves_updated_at = ? WHERE telegram_user_id = ?').bind(playerData.save.updatedAt, telegramUserId).run()
      }
      imported++
    } catch (e) {
      errors.push({ telegramUserId, error: String(e && e.message ? e.message : e) })
    }
  }

  return Response.json({ imported, total: Object.keys(players ?? {}).length, errors })
}
