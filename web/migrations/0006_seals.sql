-- The seal a user is shown with beside their name: its frame, its ink and
-- one character. A user who has chosen none keeps the defaults, and a seal
-- without a character shows the first of the display name.
ALTER TABLE users ADD COLUMN seal_frame TEXT NOT NULL DEFAULT 'double';
ALTER TABLE users ADD COLUMN seal_ink TEXT NOT NULL DEFAULT 'vermilion';
ALTER TABLE users ADD COLUMN seal_char TEXT;
