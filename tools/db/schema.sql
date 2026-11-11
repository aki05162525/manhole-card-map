-- Ledger tables. Rows live in data/db/<table>.jsonl; see docs/database-design.md.
-- Every connection must run PRAGMA foreign_keys = ON before editing.
-- Columns whose CHECK contains json_type(<column>) = 'array' or 'object' hold JSON;
-- row files hold them as arrays or objects, not as strings.

CREATE TABLE card (
  id TEXT PRIMARY KEY CHECK (id <> '' AND id = trim(id))
) STRICT;

CREATE TABLE card_alias (
  old_id TEXT PRIMARY KEY REFERENCES card (id),
  target_id TEXT NOT NULL REFERENCES card (id),
  CHECK (old_id <> target_id)
) STRICT;

CREATE TABLE card_excluded (
  card_id TEXT PRIMARY KEY REFERENCES card (id),
  reason TEXT NOT NULL CHECK (trim(reason) <> '')
) STRICT;

-- id is derived from every column except legacy_snapshot_path (see ledgerdb.evidence_id).
-- legacy_snapshot_path points into data/evidence and is dropped with it in stage D.
CREATE TABLE evidence (
  id TEXT PRIMARY KEY CHECK (id GLOB 'evidence:*'),
  source_url TEXT NOT NULL CHECK (source_url GLOB 'https://?*' OR source_url GLOB 'http://?*'),
  snapshot_sha256 TEXT NOT NULL
    CHECK (length(snapshot_sha256) = 64 AND NOT snapshot_sha256 GLOB '*[^0-9a-f]*'),
  legacy_snapshot_path TEXT NOT NULL CHECK (legacy_snapshot_path <> ''),
  source_locator TEXT NOT NULL CHECK (trim(source_locator) <> ''),
  -- A date, or an original timestamp with its offset; the ledger shows only the date.
  checked_at TEXT NOT NULL CHECK (
    (length(checked_at) = 10 AND date(checked_at) IS checked_at)
    OR (substr(checked_at, 11, 1) = 'T'
        AND (checked_at GLOB '*Z' OR checked_at GLOB '*[+-][0-9][0-9]:[0-9][0-9]')
        AND datetime(checked_at) IS NOT NULL)),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ai', 'human')),
  verification_method TEXT NOT NULL CHECK (trim(verification_method) <> ''),
  UNIQUE (source_url, snapshot_sha256, source_locator, checked_at, actor_type, verification_method)
) STRICT;

CREATE TABLE facility (
  id TEXT PRIMARY KEY CHECK (id <> '' AND id = trim(id)),
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  address TEXT NOT NULL CHECK (trim(address) <> ''),
  phone TEXT NOT NULL,
  -- Evidence that this counter exists here; never replaced by location evidence.
  identity_evidence_id TEXT NOT NULL REFERENCES evidence (id)
) STRICT;

CREATE TABLE facility_legacy_id (
  legacy_id TEXT PRIMARY KEY CHECK (legacy_id <> ''),
  facility_id TEXT NOT NULL REFERENCES facility (id),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (facility_id, position)
) STRICT;

CREATE TABLE relation (
  id TEXT PRIMARY KEY CHECK (id <> ''),
  card_id TEXT NOT NULL REFERENCES card (id),
  facility_id TEXT NOT NULL REFERENCES facility (id),
  valid_from TEXT CHECK (date(valid_from) IS valid_from),
  valid_to TEXT CHECK (date(valid_to) IS valid_to),
  status TEXT NOT NULL CHECK (status IN ('active', 'upcoming', 'suspended', 'ended', 'unknown')),
  -- NULL means the ledger has no condition key; '' is an explicit empty condition.
  condition TEXT,
  hours TEXT NOT NULL CHECK (json_valid(hours) AND json_type(hours) = 'array'),
  review_until TEXT CHECK (date(review_until) IS review_until),
  maintenance_notes TEXT
    CHECK (json_valid(maintenance_notes) AND json_type(maintenance_notes) = 'array'),
  change_kind TEXT CHECK (change_kind IN ('addition')),
  change_reason TEXT CHECK (trim(change_reason) <> ''),
  change_previous_place_ids TEXT
    CHECK (json_valid(change_previous_place_ids) AND json_type(change_previous_place_ids) = 'array'),
  change_raw TEXT CHECK (json_valid(change_raw) AND json_type(change_raw) = 'array'),
  source_hash TEXT NOT NULL
    CHECK (length(source_hash) = 64 AND NOT source_hash GLOB '*[^0-9a-f]*'),
  evidence_id TEXT NOT NULL REFERENCES evidence (id),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to),
  CHECK ((change_kind IS NULL) = (change_reason IS NULL)
         AND (change_kind IS NULL) = (change_previous_place_ids IS NULL)
         AND (change_kind IS NULL) = (change_raw IS NULL))
) STRICT;

-- '' is never a valid date, so an open end cannot collide with a dated one.
CREATE UNIQUE INDEX relation_card_facility_period
  ON relation (card_id, facility_id, ifnull(valid_from, ''), ifnull(valid_to, ''));

-- Append-only. The row with the largest seq is the current location state.
-- Rows with reason are under location review and produce locationReview.
-- adoption_sha256 and previous_state_sha256 are the digests that the manifest and
-- tools/national/location_lifecycle.py used; ledgerdb recomputes both from the rows.
CREATE TABLE location_decision (
  facility_id TEXT NOT NULL REFERENCES facility (id),
  seq INTEGER NOT NULL CHECK (seq >= 1),
  -- Digest of the state after seq - 1 (ledgerdb.decision_state).
  previous_state_sha256 TEXT
    CHECK (length(previous_state_sha256) = 64 AND NOT previous_state_sha256 GLOB '*[^0-9a-f]*'),
  action TEXT NOT NULL CHECK (action IN ('adopt', 'reaffirm', 'correct', 'withdraw')),
  lat REAL CHECK (lat BETWEEN -90 AND 90),
  lng REAL CHECK (lng BETWEEN -180 AND 180),
  scope TEXT CHECK (scope IN ('building', 'facility', 'office-entrance', 'user-designated-center',
                              'user-designated-historical-site')),
  evidence_id TEXT NOT NULL REFERENCES evidence (id),
  -- Where an adoption comes from: an approved location update (manifest locations[].approved),
  -- or a coordinate the manifest's input ledger already had. New adoptions are approved locations.
  adoption_source TEXT CHECK (adoption_source IN ('approved-location', 'input-ledger')),
  -- Digest of the reviewed adoption record (ledgerdb.adoption_record).
  adoption_sha256 TEXT
    CHECK (length(adoption_sha256) = 64 AND NOT adoption_sha256 GLOB '*[^0-9a-f]*'),
  -- Remaining adoption record fields; their structure differs per source.
  adoption_extra TEXT CHECK (json_valid(adoption_extra) AND json_type(adoption_extra) = 'object'),
  decision_id TEXT UNIQUE CHECK (decision_id <> ''),
  reason_type TEXT
    CHECK (reason_type IN ('spelling', 'relocation', 'source-withdrawal', 'evidence-update')),
  prepared_by TEXT CHECK (trim(prepared_by) <> ''),
  reviewed_by TEXT CHECK (trim(reviewed_by) <> ''),
  reviewed_at TEXT CHECK (date(reviewed_at) IS reviewed_at),
  reason TEXT CHECK (trim(reason) <> ''),
  address_status TEXT CHECK (address_status IN ('valid', 'needs-review')),
  -- Facility name and address when reviewed; a later change puts the location on hold.
  identity_name TEXT CHECK (trim(identity_name) <> ''),
  identity_address TEXT CHECK (trim(identity_address) <> ''),
  source_version TEXT CHECK (trim(source_version) <> ''),
  review_due TEXT CHECK (date(review_due) IS review_due),
  PRIMARY KEY (facility_id, seq),
  CHECK ((seq = 1) = (previous_state_sha256 IS NULL)),
  CHECK ((action = 'adopt') = (adoption_source IS NOT NULL)),
  -- An approved location is pinned by its digest; an input-ledger coordinate has none
  -- and is not under location review.
  CHECK ((adoption_source IS 'approved-location') = (adoption_sha256 IS NOT NULL)),
  CHECK (adoption_source IS NOT 'input-ledger' OR (adoption_extra IS NULL AND reason IS NULL)),
  CHECK (adoption_extra IS NULL OR adoption_sha256 IS NOT NULL),
  CHECK ((lat IS NULL) = (lng IS NULL)),
  CHECK ((action = 'withdraw') = (lat IS NULL)),
  CHECK ((action = 'adopt') = (seq = 1)),
  CHECK ((action = 'adopt') = (decision_id IS NULL)
         AND (action = 'adopt') = (reason_type IS NULL)
         AND (action = 'adopt') = (prepared_by IS NULL)
         AND (action = 'adopt') = (reviewed_by IS NULL)),
  CHECK (trim(prepared_by) <> trim(reviewed_by)),
  CHECK (action = 'adopt' OR reason IS NOT NULL),
  CHECK ((reason IS NULL) = (reviewed_at IS NULL)
         AND (reason IS NULL) = (address_status IS NULL)
         AND (reason IS NULL) = (identity_name IS NULL)
         AND (reason IS NULL) = (identity_address IS NULL)),
  CHECK (reason IS NOT NULL OR (source_version IS NULL AND review_due IS NULL)),
  CHECK (address_status IS NOT 'needs-review' OR action = 'withdraw'),
  CHECK (action <> 'reaffirm' OR reason_type NOT IN ('relocation', 'source-withdrawal'))
) STRICT;

-- Facilities in one building. If one member's identity changes, every member is held.
CREATE TABLE building_group (
  id TEXT PRIMARY KEY CHECK (trim(id) <> ''),
  evidence_id TEXT NOT NULL REFERENCES evidence (id)
) STRICT;

-- facility_id is the key, so a facility belongs to at most one group.
CREATE TABLE building_group_member (
  facility_id TEXT PRIMARY KEY REFERENCES facility (id),
  group_id TEXT NOT NULL REFERENCES building_group (id),
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (group_id, position)
) STRICT;

-- Research on facilities without a current location, copied as written from data/national
-- work-unit files (source_ref names the record at commit d5402e11). A facility whose location
-- is adopted keeps no research rows; drop them in the change that adds the adoption.
CREATE TABLE location_research (
  facility_id TEXT NOT NULL REFERENCES facility (id),
  source_ref TEXT NOT NULL CHECK (trim(source_ref) <> ''),
  work_unit TEXT NOT NULL CHECK (trim(work_unit) <> ''),
  -- A date, or a timestamp with its offset, as the work unit recorded it.
  researched_at TEXT CHECK (
    (length(researched_at) = 10 AND date(researched_at) IS researched_at)
    OR (substr(researched_at, 11, 1) = 'T'
        AND (researched_at GLOB '*Z' OR researched_at GLOB '*[+-][0-9][0-9]:[0-9][0-9]')
        AND datetime(researched_at) IS NOT NULL)),
  -- The work unit's own values; there is no shared vocabulary across work units.
  status TEXT CHECK (trim(status) <> ''),
  stage TEXT CHECK (trim(stage) <> ''),
  blockers TEXT CHECK (json_valid(blockers) AND json_type(blockers) = 'array'),
  finding TEXT CHECK (trim(finding) <> ''),
  stop_condition TEXT CHECK (trim(stop_condition) <> ''),
  resume_condition TEXT CHECK (trim(resume_condition) <> ''),
  next_action TEXT CHECK (trim(next_action) <> ''),
  PRIMARY KEY (facility_id, source_ref),
  CHECK (coalesce(status, stage, blockers, finding, stop_condition, resume_condition, next_action) IS NOT NULL)
) STRICT;

-- Terms of use of a location source, reviewed for exact location records only.
CREATE TABLE source_review (
  id TEXT PRIMARY KEY CHECK (trim(id) <> ''),
  source_name TEXT NOT NULL CHECK (trim(source_name) <> ''),
  source_version TEXT NOT NULL CHECK (trim(source_version) <> ''),
  source_derivation TEXT NOT NULL CHECK (trim(source_derivation) <> ''),
  -- conditional and usable approve a use under the stated conditions, not the location.
  status TEXT NOT NULL CHECK (status IN ('unreviewed', 'needs-review', 'conditional', 'usable', 'prohibited')),
  checked_at TEXT NOT NULL CHECK (date(checked_at) IS checked_at),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ai', 'human')),
  conditions TEXT NOT NULL CHECK (trim(conditions) <> ''),
  notes TEXT CHECK (trim(notes) <> '')
) STRICT;

CREATE TABLE source_review_evidence (
  review_id TEXT NOT NULL REFERENCES source_review (id),
  position INTEGER NOT NULL CHECK (position >= 0),
  url TEXT NOT NULL CHECK (url GLOB 'https://?*' OR url GLOB 'http://?*'),
  locator TEXT NOT NULL CHECK (trim(locator) <> ''),
  checked_at TEXT NOT NULL CHECK (date(checked_at) IS checked_at),
  PRIMARY KEY (review_id, position)
) STRICT;

-- The location decision a review read. record_sha256 is the adoption_sha256 of an approved
-- adoption, or else the digest of the facility's exported ledger place while that decision is current.
CREATE TABLE source_review_target (
  facility_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  review_id TEXT NOT NULL REFERENCES source_review (id),
  record_sha256 TEXT NOT NULL CHECK (length(record_sha256) = 64 AND NOT record_sha256 GLOB '*[^0-9a-f]*'),
  PRIMARY KEY (facility_id, seq),
  FOREIGN KEY (facility_id, seq) REFERENCES location_decision (facility_id, seq)
) STRICT;
