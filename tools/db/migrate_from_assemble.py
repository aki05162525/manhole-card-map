"""One-off migration: write data/db rows from assemble.py output. Delete with assemble.py in stage C.

Besides the assembled ledger and audit, it reads the location update rows and location
lifecycle files that the manifest selects, for adoption digests and building groups.
Rerun it whenever the manifest or data/card-ids.json changes before stage C.
"""
import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import ledgerdb as db


def relation_id(row):
    key = [row['cardId'], row['placeId'], row.get('validFrom'), row.get('validTo')]
    return 'relation:' + hashlib.sha256(json.dumps(key, ensure_ascii=False).encode()).hexdigest()[:20]


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def selected_sources(root, manifest):
    """Location update rows by facility with their approved digest, and building groups."""
    updates = {}
    for selection in manifest['locations']:
        rows = {row['facilityId']: row for row in read_json(root / selection['path'])['updates']}
        for approved in selection['approved']:
            row = rows[approved['facilityId']]
            if db.digest(row) != approved['sha256']:
                raise db.LedgerError(f'approved location changed: {approved["facilityId"]}')
            updates[approved['facilityId']] = (row, approved['sha256'])
    groups = []
    for selection in manifest.get('locationLifecycle', []):
        path = root / selection['path']
        if hashlib.sha256(path.read_bytes()).hexdigest() != selection['sha256']:
            raise db.LedgerError(f'location lifecycle selection hash mismatch: {selection["path"]}')
        groups.extend(read_json(path)['groups'])
    return updates, groups


def rows_from(ledger, audit, card_ids, updates, groups):
    evidence = {}

    def add(ev):
        row = dict(source_url=ev['sourceUrl'], snapshot_sha256=ev['snapshotSHA256'],
                   legacy_snapshot_path=ev['snapshotPath'], source_locator=ev['sourceLocator'],
                   checked_at=ev['checkedAt'], actor_type=ev['actorType'],
                   verification_method=ev['verificationMethod'])
        row['id'] = db.evidence_id(row)
        if evidence.setdefault(row['id'], row) != row:
            raise db.LedgerError(f'evidence differs only by snapshot path: {row["id"]}')
        return row['id']

    def key_order(entity, entity_id, value, default):
        row_keys, evidence_keys = list(value), list(value['evidence'])
        row = dict(entity=entity, id=entity_id,
                   row_keys=None if row_keys == [k for k in default if k in value] else row_keys,
                   evidence_keys=None if evidence_keys == list(db.EVIDENCE_KEYS) else evidence_keys)
        if row['row_keys'] or row['evidence_keys']:
            orders.append(row)

    def reviewed(state):
        return dict(reviewed_at=state['reviewedAt'], reason=state['reason'], address_status=state['addressStatus'],
                    identity_name=state['identity']['name'], identity_address=state['identity']['address'],
                    source_version=state['sourceVersion'] or None, review_due=state['reviewDue'] or None)

    def decision(fid, seq, action, coordinate, ev, **extra):
        row = dict(facility_id=fid, seq=seq, previous_state_sha256=None, action=action,
                   lat=coordinate['lat'] if coordinate else None, lng=coordinate['lng'] if coordinate else None,
                   scope=None, evidence_id=add(ev), adoption_source=None, adoption_sha256=None, adoption_extra=None,
                   decision_id=None, reason_type=None, prepared_by=None,
                   reviewed_by=None, reviewed_at=None, reason=None, address_status=None, identity_name=None,
                   identity_address=None, source_version=None, review_due=None)
        row.update(extra)
        decisions.append(row)

    locations = {row['facilityId']: row for row in audit['locations']}
    lifecycle = {row['facilityId']: row for row in audit.get('locationLifecycle', {}).get('facilities', [])}
    facilities, legacy, decisions, orders = [], [], [], []
    for place in ledger['places']:
        fid = place['id']
        identity = locations[fid]['previousEvidence'] if fid in locations else place['evidence']
        facilities.append(dict(id=fid, name=place['name'], address=place['address'], phone=place['phone'],
                               identity_evidence_id=add(identity)))
        legacy.extend(dict(legacy_id=v, facility_id=fid, position=i) for i, v in enumerate(place['legacyIds']))
        key_order('facility', fid, place, db.FACILITY_KEYS)
        if fid in lifecycle or fid in updates:
            # The lifecycle binding pins the same record as the manifest approval.
            if fid in lifecycle:
                binding = lifecycle[fid]['binding']
                record, sha = binding['adoption'], binding['adoptionSHA256']
                if fid in updates and updates[fid][1] != sha:
                    raise db.LedgerError(f'bound adoption differs from the manifest approval: {fid}')
            else:
                record, sha = updates[fid]
            if fid in locations and locations[fid]['originalEvidence'] != record['evidence']:
                raise db.LedgerError(f'audit evidence differs from the adoption record: {fid}')
            extra = {k: v for k, v in record.items() if k not in db.ADOPTION_KEYS}
            adoption = dict(scope=record.get('scope'), adoption_source='approved-location', adoption_sha256=sha,
                            adoption_extra=extra or None)
            if fid not in lifecycle:
                decision(fid, 1, 'adopt', record['coordinate'], record['evidence'], **adoption)
                continue
            history = lifecycle[fid]['history']
            initial = history[0]['previousState'] if history else lifecycle[fid]['state']
            decision(fid, 1, 'adopt', record['coordinate'], record['evidence'], **adoption, **reviewed(initial))
            for seq, step in enumerate(history, 2):
                event, state = step['event'], step['nextState']
                decision(fid, seq, event['action'], state['coordinate'], event['evidence'],
                         previous_state_sha256=event['previousSHA256'], decision_id=event['id'],
                         reason_type=event['reasonType'], prepared_by=event['preparedBy'],
                         reviewed_by=event['reviewedBy'], **reviewed(state))
        elif 'coordinate' in place:
            # The input ledger carried the coordinate under the facility's own evidence.
            decision(fid, 1, 'adopt', place['coordinate'], place['evidence'], adoption_source='input-ledger')
    relations = []
    for r in ledger['relations']:
        change = r.get('change')
        if change is not None and list(change) != ['kind', 'reason', 'previousPlaceIds', 'raw']:
            raise db.LedgerError(f'unsupported change fields: {r["cardId"]} {r["placeId"]}')
        rid = relation_id(r)
        relations.append(dict(
            id=rid, card_id=r['cardId'], facility_id=r['placeId'], valid_from=r.get('validFrom'),
            valid_to=r.get('validTo'), status=r['status'], condition=r.get('condition'), hours=r['hours'],
            review_until=r.get('reviewUntil'), maintenance_notes=r.get('maintenanceNotes'),
            change_kind=change and change['kind'], change_reason=change and change['reason'],
            change_previous_place_ids=change and change['previousPlaceIds'], change_raw=change and change['raw'],
            source_hash=r['sourceHash'], evidence_id=add(r['evidence'])))
        key_order('relation', rid, r, db.RELATION_KEYS)
    building_groups = [dict(id=g['id'], evidence_id=add(g['evidence'])) for g in groups]
    return dict(
        card=[dict(id=v) for v in card_ids['ids']],
        card_alias=[dict(old_id=k, target_id=v) for k, v in card_ids['aliases'].items()],
        card_excluded=[dict(card_id=k, reason=v) for k, v in card_ids['excluded'].items()],
        evidence=list(evidence.values()), facility=facilities, facility_legacy_id=legacy,
        relation=relations, location_decision=decisions,
        building_group=building_groups,
        building_group_member=[dict(facility_id=fid, group_id=g['id'], position=i)
                               for g in groups for i, fid in enumerate(g['facilityIds'])],
        assemble_key_order=orders)


def migrate(root, ledger_text, audit, out, manifest='tools/national/manifest.json'):
    card_ids = read_json(root / 'data/card-ids.json')
    updates, groups = selected_sources(root, read_json(root / manifest))
    with closing(db.load(rows_from(json.loads(ledger_text), audit, card_ids, updates, groups))) as database:
        if db.export_ledger(database) != ledger_text:
            raise db.LedgerError('rows do not reproduce the assembled ledger')
        if db.export_card_ids(database) != card_ids:
            raise db.LedgerError('rows do not reproduce data/card-ids.json')
        db.dump(database, out)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=db.ROOT)
    parser.add_argument('--ledger', type=Path, help='assemble.py --out; default: run assemble.py')
    parser.add_argument('--audit', type=Path, help='assemble.py --audit-out; required with --ledger')
    parser.add_argument('--out', type=Path, help=f'default: <root>/{db.ROWS}')
    args = parser.parse_args()
    if (args.ledger is None) != (args.audit is None):
        parser.error('--ledger and --audit go together')
    try:
        with tempfile.TemporaryDirectory(prefix='ledger-migrate-') as temporary:
            ledger, audit = args.ledger, args.audit
            if ledger is None:
                ledger, audit = Path(temporary) / 'ledger.json', Path(temporary) / 'audit.json'
                subprocess.run([sys.executable, '-B', 'tools/national/assemble.py', '--out', str(ledger),
                                '--audit-out', str(audit)], cwd=args.root, check=True)
            migrate(args.root, ledger.read_text(encoding='utf-8'),
                    json.loads(audit.read_text(encoding='utf-8')), args.out or args.root / db.ROWS)
    except (db.LedgerError, subprocess.CalledProcessError, OSError, KeyError) as error:
        parser.exit(1, f'migration failed: {error}\n')


if __name__ == '__main__':
    main()
