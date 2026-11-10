-- Per-user counters for the abuse limits (AZ-7). One row per user and limit,
-- holding the current fixed window; a new window resets the count.

CREATE TABLE rate_limits (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
) STRICT;
