-- Per-user fixed-window counters for the longer abuse limits (AZ-7), such as
-- 20 friend requests a day. One row per user and kind holds the current
-- window; a new window resets the count. The per-minute write quota is
-- records_write_events (0002).

CREATE TABLE rate_limits (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
) STRICT;
