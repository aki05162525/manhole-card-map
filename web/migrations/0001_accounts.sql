-- Accounts, receipt records and friends (docs/account-design.md).
-- Times are Unix milliseconds. IDs and tokens are random; secrets are stored
-- only as SHA-256 hex. Every row of a user goes with ON DELETE CASCADE (PR-4).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  public_key BLOB NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
) STRICT;
CREATE INDEX credentials_user ON credentials (user_id);

-- Looked up by the code alone (AU-10).
CREATE TABLE recovery_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  used_at INTEGER
) STRICT;
CREATE INDEX recovery_codes_user ON recovery_codes (user_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('normal', 'recovery')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  verified_at INTEGER
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE challenges (
  challenge TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX challenges_expires ON challenges (expires_at);

-- card_id is the official card number; no foreign key (DA-1).
CREATE TABLE records (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  received_on TEXT CHECK (
    received_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  memo TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, card_id)
) STRICT;

CREATE TABLE invites (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE TABLE friend_requests (
  from_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_user_id, to_user_id),
  CHECK (from_user_id <> to_user_id)
) STRICT;
CREATE INDEX friend_requests_to ON friend_requests (to_user_id);

-- One row per pair, smaller ID first.
CREATE TABLE friendships (
  user_a TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
) STRICT;
CREATE INDEX friendships_b ON friendships (user_b);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
) STRICT;
CREATE INDEX blocks_blocked ON blocks (blocked_id);
