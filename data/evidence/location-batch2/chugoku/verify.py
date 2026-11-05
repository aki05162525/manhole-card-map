"""Validate the research boundary; --raw also verifies ignored original bytes."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools/national'))
from research_baseline import check_research_only


def read(path):
    return json.loads((ROOT / path).read_text())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw', action='store_true')
    args = parser.parse_args()
    selection = read('data/national/location-batch2/chugoku/selection.json')
    outcomes = read('data/national/location-batch2/chugoku/outcomes.json')
    sources = read('data/evidence/location-batch2/chugoku/sources.json')['sources']
    snapshot = read('data/national/issue24/priorities-snapshot.json')['rows']
    population = {r['facilityId'] for r in snapshot if 'issue7/chugoku.json#' in r['originalRef']}
    baseline = set(read('data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
    coverage = selection['coverage']
    assert len(coverage) == len(population) == 47
    assert {r['facilityId'] for r in coverage} == population <= baseline
    selected = {r['facilityId'] for r in selection['rows']}
    assert len(selection['rows']) == len(selected) == len(outcomes['rows']) == 8
    assert {r['facilityId'] for r in outcomes['rows']} == selected
    assert {r['facilityId'] for r in coverage if r['selected']} == selected
    for r in coverage:
        assert r['selected'] or r['exclusionReason']
        p, pointer = r['originalRef'].split('#/')
        value = read(p)
        for component in pointer.split('/'):
            value = value[int(component)] if isinstance(value, list) else value[component]
        assert value['facilityId'] == r['facilityId']
    ledger, current, integration = check_research_only(
        ROOT, 'chugoku', selection, 'data/work/location-batch2/chugoku/before.json')
    places = {r['id']: r for r in ledger['places']}
    unlocated = {fid for fid, r in places.items() if not r.get('coordinate')}
    assert len(unlocated) == 608
    assert len(population & unlocated) == 46
    assert selected <= unlocated
    assert population - unlocated == {'facility:cs-56534586c259fb790a'}
    if args.raw:
        assert ledger == read('data/work/location-batch2/chugoku/before.json')
    source_ids = {r['id'] for r in sources}
    assert len(source_ids) == len(sources)
    for row in outcomes['rows']:
        assert set(row['sourceIds']) <= source_ids
        assert row['status'] == 'held' and row['proposal'] is None
        assert row['stopCondition'] and row['resumeCondition']
    assert outcomes['adopted'] == outcomes['proposed'] == 0 and outcomes['held'] == 8
    assert not outcomes['manifestChanged'] and not outcomes['bindingIds']
    # No selected facility may silently be an earlier exceptional hold.
    for path in ['data/national/issue20/selection.json', 'data/national/issue25/investigation.json',
                 'data/national/issue26/outcomes.json', 'data/national/issue27/outcomes.json']:
        text = (ROOT / path).read_text()
        assert not any(fid in text for fid in selected), path
    for path, expected in selection['inputSHA256'].items():
        if path == 'tools/national/manifest.json' or (path.startswith('data/work/') and not args.raw):
            continue
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path
    if args.raw:
        for source in sources:
            if source.get('status') == 200:
                raw = (ROOT / source['snapshotPath']).read_bytes()
                assert len(raw) == source['bytes']
                assert hashlib.sha256(raw).hexdigest() == source['sha256']
            else:
                assert source.get('error') and 'snapshotPath' not in source
    print(json.dumps({'population': len(population), 'selected': len(selected),
                      'held': 8, 'adopted': 0, 'sources': len(sources),
                      'rawHashesVerified': args.raw, **integration}, ensure_ascii=False))


if __name__ == '__main__':
    main()
