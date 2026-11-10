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

-- Counts accounts created in the current window.
CREATE INDEX users_created ON users (created_at);
