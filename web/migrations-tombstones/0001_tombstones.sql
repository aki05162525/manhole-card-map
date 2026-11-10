-- A separate D1 that outlives a Time Travel restore of the main database:
-- replay these IDs after a restore so deletions stay deleted (PR-6).
-- Rows older than 35 days are removed. Times are Unix milliseconds.

CREATE TABLE tombstones (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (
    kind IN ('account', 'credential', 'friendship', 'block')
  ),
  -- The user, or the credential ID for kind = 'credential'.
  subject TEXT NOT NULL,
  -- The other user of a friendship or block.
  object TEXT,
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX tombstones_created ON tombstones (created_at);
