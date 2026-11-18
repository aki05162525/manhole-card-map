-- The AAGUID a registration carried: which passkey manager keeps the
-- passkey (docs/account-design.md AU-2). Only for showing its name or icon
-- in the settings; anyone can send any value, so nothing is decided by it.
-- NULL for the passkeys registered before this column.
ALTER TABLE credentials ADD COLUMN aaguid TEXT;
