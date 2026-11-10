-- Passkey ceremonies and recovery limits (docs/account-design.md AU-3, AU-10).

-- The user a challenge belongs to: the new account's ID while registering,
-- or the signed-in user. NULL for a passkey login, which names no user.
-- No foreign key: the account does not exist yet while registering.
ALTER TABLE challenges ADD COLUMN subject TEXT;

-- Failed recovery attempts across all users, per 10-minute window
-- (floor(unix ms / 600000)). Holds no IP or code (PR-1, PR-3).
CREATE TABLE recovery_failures (
  bucket INTEGER PRIMARY KEY,
  failures INTEGER NOT NULL
) STRICT;
