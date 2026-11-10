-- Rolling one-minute receipt-write quota, shared by all Worker instances.
-- Old events are pruned on the user's next write; at most 60 rows per user.
CREATE TABLE records_write_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  written_at INTEGER NOT NULL
) STRICT;
CREATE INDEX records_write_events_user_time ON records_write_events (user_id, written_at);
