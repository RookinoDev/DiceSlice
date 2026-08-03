-- D1 holds only what's genuinely cross-user: the leaderboard/re-engagement index (denormalized,
-- upserted by each PlayerDO), the global card serial ticker (must be unique across every
-- player, not per-user - see playerDurableObject.mjs's openPack/craftCard for why this can't
-- live in a per-user DO), and referrals (its one write is a single atomic INSERT OR IGNORE, no
-- read-then-branch, so it never needed DO-style single-threading in the first place). Everything
-- else (saves, packs, pity counters, dust, purchases, showcase, gem sockets) lives in each
-- player's own Durable Object storage - see playerDurableObject.mjs.

CREATE TABLE player_index (
  telegram_user_id      INTEGER PRIMARY KEY,
  first_name            TEXT,
  username               TEXT,
  photo_url               TEXT,
  deepest_stage           INTEGER NOT NULL DEFAULT 0,
  bosses_defeated         INTEGER NOT NULL DEFAULT 0,
  prestige_count          INTEGER NOT NULL DEFAULT 0,
  deepest_boss_cleared     INTEGER NOT NULL DEFAULT 0,
  saves_updated_at        INTEGER, -- NULL until the first real save sync (mirrors the old INNER JOIN exclusion of never-synced users)
  notifications_enabled   INTEGER NOT NULL DEFAULT 1,
  last_notified_at        INTEGER
);

CREATE TABLE card_counters_v (
  card_id     TEXT NOT NULL,
  variant     TEXT NOT NULL,
  next_serial INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (card_id, variant)
);

CREATE TABLE referrals (
  referred_user_id INTEGER PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL,
  created_at        INTEGER NOT NULL
);
CREATE INDEX ix_referrals_referrer ON referrals(referrer_user_id);
