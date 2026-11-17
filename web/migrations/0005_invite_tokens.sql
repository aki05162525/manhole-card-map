-- The invite link no longer expires and the friends page shows it every
-- time, so the token is kept as it is instead of as a digest (AZ-3). The
-- links made before stop working: only their digests were kept.
DROP TABLE invites;

CREATE TABLE invites (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE
) STRICT;
