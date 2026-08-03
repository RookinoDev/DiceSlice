-- Lightweight analytics event log - cross-user by nature (funnel/revenue aggregation needs every
-- player's events in one place), so this lives in D1 like migrations/0001's cross-user tables.
-- Generic (type, item, value_stars) columns instead of a table per event type - the funnel this
-- needs to answer (session/DAU counts, invoice-to-purchase conversion, revenue by SKU/day) only
-- needs a handful of event types today; adding a new type never requires a schema migration.
CREATE TABLE events (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  type              TEXT NOT NULL,
  telegram_user_id  INTEGER NOT NULL,
  item              TEXT,
  value_stars       INTEGER,
  created_at        INTEGER NOT NULL
);
CREATE INDEX ix_events_type_created ON events(type, created_at);
