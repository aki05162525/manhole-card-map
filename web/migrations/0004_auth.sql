-- Passkey ceremonies and recovery limits (docs/account-design.md AU-3, AU-10).

-- Challenges are signed by the Worker and stored nowhere (AU-3), so an
-- unauthenticated options request writes nothing. Only the nonce of a
-- challenge spent by a verified response is kept, until it expires.
DROP TABLE challenges;
CREATE TABLE used_challenges (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX used_challenges_expires ON used_challenges (expires_at);

-- Failed recovery attempts across all users, per 10-minute window
-- (floor(unix ms / 600000)). Holds no IP or code (PR-1, PR-3).
CREATE TABLE recovery_failures (
  bucket INTEGER PRIMARY KEY,
  failures INTEGER NOT NULL
) STRICT;

-- New accounts across all users in the latest 10-minute window (AZ-7). One
-- row: a request from an older window counts against the latest one, so a
-- late request never reopens a past window. Kept when an account is
-- deleted so deleting cannot free a slot. No user ID.
CREATE TABLE registration_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
) STRICT;

-- Proof that a change recorded in tombstones was applied (PR-6): written in
-- the same batch as the change, so it exists exactly when the change
-- committed. Reconciliation reads it; it is cleared once the tombstone is
-- 'done'. No foreign key, so deleting an account keeps it.
CREATE TABLE applied_changes (
  change_id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
) STRICT;
