-- A record is written as 'pending' before the deletion and set to 'done'
-- after it. Only 'done' rows are replayed after a restore; reconciliation
-- (scripts/reconcile-tombstones.mjs) settles 'pending' ones first.
ALTER TABLE tombstones ADD COLUMN state TEXT NOT NULL DEFAULT 'pending' CHECK (
  state IN ('pending', 'done')
);
CREATE INDEX tombstones_pending ON tombstones (state) WHERE state = 'pending';
