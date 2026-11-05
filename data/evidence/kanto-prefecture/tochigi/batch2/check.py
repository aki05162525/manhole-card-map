"""Check unapproved research inputs without changing proposals or their hashes."""
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT / 'tools/national'))
from assemble import assemble
from location_lifecycle import digest, fields


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text())


def check_selected_inputs(root, selection):
    updates = []
    seen = set()
    for source in selection['locations']:
        rows = read(root / source['path'])['updates']
        by_id = {row['facilityId']: row for row in rows}
        if len(by_id) != len(rows):
            raise ValueError('duplicate proposed facility')
        for selected in source['approved']:
            fid = selected['facilityId']
            if fid not in by_id:
                raise ValueError('selected update missing: ' + fid)
            update = by_id[fid]
            if digest(update) != selected['sha256']:
                raise ValueError('selected update hash mismatch: ' + fid)
            if fid in seen:
                raise ValueError('duplicate selected facility: ' + fid)
            seen.add(fid)
            ev = update['evidence']
            if sha(root / ev['snapshotPath']) != ev['snapshotSHA256']:
                raise ValueError('numeric original hash mismatch: ' + fid)
            updates.append(update)
    bindings = {}
    for source in selection['locationLifecycle']:
        path = root / source['path']
        if sha(path) != source['sha256']:
            raise ValueError('lifecycle file hash mismatch')
        document = read(path)
        fields(document, ('schema', 'bindings', 'events', 'groups'))
        for binding in document['bindings']:
            fid = binding['facilityId']
            if fid in bindings:
                raise ValueError('duplicate binding: ' + fid)
            bindings[fid] = binding
    if set(bindings) != seen:
        raise ValueError('binding IDs differ from selection')
    for update in updates:
        binding = bindings[update['facilityId']]
        if binding['adoption'] != update or binding['adoptionSHA256'] != digest(update):
            raise ValueError('binding adoption mismatch: ' + update['facilityId'])
    return updates


def main():
    national = ROOT / 'data/national/kanto-prefecture/tochigi'
    evidence = ROOT / 'data/evidence/kanto-prefecture/tochigi'
    selection_path = national / 'batch2-selection-proposed.json'
    selection_before = selection_path.read_bytes()
    selection = read(selection_path)
    updates = check_selected_inputs(ROOT, selection)
    manifest_path = ROOT / 'tools/national/manifest.json'
    manifest_before = manifest_path.read_bytes()
    manifest = read(manifest_path)
    baseline, audit = assemble(ROOT, manifest)
    proposed = copy.deepcopy(manifest)
    for key in ('locations', 'locationLifecycle'):
        proposed[key].extend(selection[key])
    hypothetical, _ = assemble(ROOT, proposed)
    bp = {row['id']: row for row in baseline['places']}
    hp = {row['id']: row for row in hypothetical['places']}
    selected_ids = {row['facilityId'] for row in updates}
    changed = {fid for fid in bp if bp[fid] != hp[fid]}
    if changed != selected_ids or baseline['relations'] != hypothetical['relations']:
        raise ValueError('unexpected whole-ledger delta')
    inventory = read(national / 'inventory.json')
    for row in inventory['rows']:
        if bp[row['facilityId']] != row['baselinePlace']:
            raise ValueError('old place changed: ' + row['facilityId'])
    for path, expected in inventory['inputSHA256'].items():
        if sha(ROOT / path) != expected:
            raise ValueError('historical input hash mismatch: ' + path)
    records = read(evidence / 'batch2/export-index.json')['records']
    for record in records:
        if sha(ROOT / record['persistedPath']) != record['sha256']:
            raise ValueError('exported evidence hash mismatch: ' + record['persistedPath'])
    outcomes = read(national / 'batch2-outcomes.json')['rows']
    target_ids = {row['facilityId'] for row in inventory['rows']}
    if len(outcomes) != 20 or {row['facilityId'] for row in outcomes} != target_ids:
        raise ValueError('coverage must contain every one of the 20 fixed IDs')
    if manifest_path.read_bytes() != manifest_before or selection_path.read_bytes() != selection_before:
        raise ValueError('read-only validation changed an input')
    result = {
        'schema': 1, 'exitCode': 0, 'asOf': '2026-11-05',
        'command': 'python3 -B data/evidence/kanto-prefecture/tochigi/batch2/check.py',
        'adoptionApproved': False, 'sharedManifestUnchanged': True,
        'unlocatedBaseline': sum(not row.get('coordinate') for row in baseline['places']),
        'unlocatedHypothetical': sum(not row.get('coordinate') for row in hypothetical['places']),
        'unchangedRelations': True, 'changedPlaceIds': sorted(changed),
        'wholeLedgerDelta': [{'facilityId': fid, 'old': bp[fid], 'hypothetical': hp[fid]} for fid in sorted(changed)],
        'targetCount': len(outcomes), 'exportedEvidenceCount': len(records),
        'inputSHA256': {**audit['inputSHA256'], **{str(p.relative_to(ROOT)): sha(p) for p in national.glob('*.json')},
                        str(Path(__file__).relative_to(ROOT)): sha(Path(__file__))},
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
