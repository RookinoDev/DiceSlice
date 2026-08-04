-- VIP expiry push (see worker.mjs's scheduled()) needs to scan across every player cheaply, so
-- vip_expires_at is denormalized into player_index at save-sync time - same "extract at write
-- time" pattern deepest_stage/bosses_defeated/etc already use (see migrations/0001), since a
-- per-user Durable Object can't be queried cross-user the way D1 can. Stored in epoch
-- milliseconds (matching saves_updated_at/last_notified_at), converted from the save's
-- vipExpiresUnixSeconds (epoch seconds) at write time.
-- vip_expiry_notified_at is the exactly-once-per-expiry-cycle guard - see
-- getPlayersDueForVipExpiryNotice in d1.mjs for why comparing it against the CURRENT
-- vip_expires_at (not just "notified recently") is what makes a VIP renewal correctly reset it.
ALTER TABLE player_index ADD COLUMN vip_expires_at INTEGER;
ALTER TABLE player_index ADD COLUMN vip_expiry_notified_at INTEGER;
