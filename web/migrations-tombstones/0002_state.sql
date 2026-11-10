-- A record is written as 'pending' before the change and set to 'done'
-- after it. Only 'done' rows are replayed after a restore; reconciliation
-- (scripts/reconcile-tombstones.mjs) settles 'pending' ones first by the
-- applied_changes row the change wrote under change_id in the main database.
ALTER TABLE tombstones ADD COLUMN state TEXT NOT NULL DEFAULT 'pending' CHECK (
  state IN ('pending', 'done')
);
ALTER TABLE tombstones ADD COLUMN change_id TEXT;
CREATE UNIQUE INDEX tombstones_change ON tombstones (change_id);
CREATE INDEX tombstones_pending ON tombstones (state) WHERE state = 'pending';
