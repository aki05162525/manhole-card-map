"""Verify records and integration; --raw also checks local ignored source bytes."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
N = ROOT / 'data/national/location-batch2/tohoku'
E = Path(__file__).resolve().parent
load = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
canonical = lambda d: hashlib.sha256(json.dumps(d, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def validate_claims(rows, facts, comparisons):
    fact_ids = {f['sourceId'] for f in facts}
    by_id = {c['id']: c for c in comparisons}
    for row in rows:
        missing = set(row['sourceIds']) - fact_ids
        if missing:
            raise ValueError(f'missing fact for {row["facilityId"]}: {missing}')
        ref = row.get('comparisonRef')
        if row['stage'] == 'building-comparison':
            if ref not in by_id:
                raise ValueError('building-comparison requires a comparison record')
            c = by_id[ref]
            if c['performed'] is not True:
                raise ValueError('comparison must be performed')
            if row['facilityId'] not in c['facilityIds']:
                raise ValueError('comparison belongs to another facility')
            if not c['positiveEvidence'] or not c['limitations']:
                raise ValueError('comparison needs positive evidence and limitations')
        elif ref is not None:
            raise ValueError('non-comparison stage cannot claim a comparison')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw', action='store_true')
    args = parser.parse_args()
    s, c, o = (load(N / name) for name in ['selection.json', 'coverage.json', 'outcomes.json'])
    manifest = load(ROOT / 'tools/national/manifest.json')
    for path, digest in s['inputSHA256'].items():
        if path != 'tools/national/manifest.json':
            assert sha(ROOT / path) == digest, path
    historical = copy.deepcopy(manifest)
    for key in ['locations', 'locationLifecycle']:
        historical[key] = [p for p in historical.get(key, [])
                           if not p['path'].startswith('data/national/location-batch2/')]
    assert canonical(historical) == s['baseManifestCanonicalSHA256']
    base_ids = set(load(ROOT / 'data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
    priority = [r for r in load(ROOT / 'data/national/issue24/priorities-snapshot.json')['rows']
                if r['originalRef'].startswith('data/national/issue7/tohoku.json#')]
    ids = {r['facilityId'] for r in priority}
    assert ids <= base_ids
    assert len(ids) == s['regionalPopulation'] == len(c['rows'])
    assert {r['facilityId'] for r in c['rows']} == ids
    selected = {r['facilityId'] for r in s['selected']}
    assert len(selected) == o['selectionCount'] == len(o['rows'])
    assert {r['facilityId'] for r in o['rows']} == selected
    for r in c['rows']:
        for ref in [r['originalRef'], *r['reviewRefs']]:
            path, pointer = ref.split('#', 1)
            value = load(ROOT / path)
            for part in pointer.strip('/').split('/'):
                value = value[int(part)] if isinstance(value, list) else value[part]
            assert value['facilityId'] == r['facilityId'], ref
    sources = {r['id']: r for r in load(E / 'retrievals.json')['records'] if r.get('status') == 200}
    facts = load(E / 'facts.json')['rows']
    comparisons = load(E / 'building-comparisons.json')['rows']
    validate_claims(o['rows'], facts, comparisons)
    for r in o['rows']:
        assert r['newMethod'] and r['stopCondition'] and r['resumeCondition']
        assert set(r['sourceIds']) <= sources.keys()
    for f in facts:
        src = sources[f['sourceId']]
        assert f['snapshotSHA256'] == src['sha256']
        assert f['sourceUrl'] == src['url'] and f['retrievedAt'] == src['retrievedAt']
    for t in load(E / 'vector-inputs.json')['tiles']:
        assert sha(E / t['file']) == t['sha256']
    assert len(load(E / 'derived-comparisons.json')['rows']) == o['comparisonCandidateCount']
    if args.raw:
        for r in sources.values():
            assert sha(ROOT / r['path']) == r['sha256'], r['path']
        for r in load(E / 'vector-retrievals.json'):
            assert sha(ROOT / r['path']) == r['sha256'], r['path']
    sys.path.insert(0, str(ROOT / 'tools/national'))
    import assemble
    baseline, _ = assemble.assemble(ROOT, historical)
    regional_before = copy.deepcopy(manifest)
    for key in ('locations', 'locationLifecycle'):
        regional_before[key] = [r for r in regional_before.get(key, [])
                                if not r['path'].startswith('data/national/location-batch2/tohoku/')]
    before, _ = assemble.assemble(ROOT, regional_before)
    ledger, _ = assemble.assemble(ROOT, manifest)
    old = {p['id']: p for p in before['places']}
    places = {p['id']: p for p in ledger['places']}
    updates = load(N / 'locations.json')['updates']
    updated = {u['facilityId'] for u in updates}
    assert updated <= selected
    assert all(not old[i].get('coordinate') for i in ids)
    assert {fid for fid in old if old[fid] != places[fid]} == updated
    assert before['relations'] == ledger['relations']
    for row in o['rows']:
        fid = row['facilityId']
        if fid not in updated:
            assert row['status'] == 'held' and row['adoptedCoordinate'] is None and row['binding'] is None
        else:
            assert row['status'] in ('proposed', 'adopted')
            assert row['binding'] and places[fid]['coordinate'] == next(u['coordinate'] for u in updates if u['facilityId'] == fid)
    assert sum(r['status'] == 'held' for r in o['rows']) == o['heldCount']
    assert sum(r['status'] == 'adopted' for r in o['rows']) == o['adoptedCount']
    assert sum(not p.get('coordinate') for p in baseline['places']) == o['nationalUnlocatedBefore']
    assert sum(not p.get('coordinate') for p in old.values()) - sum(not p.get('coordinate') for p in places.values()) == len(updated)
    assert sum(not places[i].get('coordinate') for i in ids) == o['regionalUnlocatedAfter']
    print(json.dumps({'status': 'pass', 'regionalPopulation': len(ids), 'selected': len(selected),
                      'integrated': len(updated), 'adopted': o['adoptedCount'], 'held': o['heldCount'],
                      'rawChecked': args.raw,
                      'currentNationalUnlocated': sum(not p.get('coordinate') for p in places.values())}, indent=2))


if __name__ == '__main__':
    main()
