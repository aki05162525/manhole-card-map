"""Offline research checks; no coordinate adoption or manifest mutation.
Run from repository root with mise exec -- python3 -B .../verify.py [--raw].
--raw additionally requires ignored originals retained in this worktree.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
D = ROOT / 'data/national/location-batch2/hokuriku'
E = ROOT / 'data/evidence/location-batch2/hokuriku'


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve(ref):
    path, _, pointer = ref.partition('#')
    value = read(ROOT / path)
    for key in pointer.strip('/').split('/') if pointer else []:
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw', action='store_true')
    args = parser.parse_args()
    selection = read(D / 'selection.json')
    baseline = read(ROOT / 'data/national/location-batch1/baseline.json')
    priorities = read(ROOT / 'data/national/issue24/priorities-snapshot.json')
    expected = {r['facilityId'] for r in priorities['rows']
                if r['originalRef'].startswith('data/national/issue7/hokuriku.json#')}
    coverage = selection['coverage']
    assert len(coverage) == len(expected) == 32
    assert {r['facilityId'] for r in coverage} == expected
    assert expected <= set(baseline['assembledUnlocatedIds'])
    selected = {r['facilityId'] for r in selection['selected']}
    assert len(selected) == len(selection['selected']) == 8
    assert selected == {r['facilityId'] for r in coverage if r['selection'] == 'selected'}
    for path, sha in selection['inputSHA256'].items():
        source = E / 'baseline-manifest.json' if path == 'tools/national/manifest.json' else ROOT / path
        assert digest(source) == sha, path
    manifest_before = digest(ROOT / 'tools/national/manifest.json')
    ledger = json.loads(subprocess.check_output(
        ['python3', '-B', 'tools/national/assemble.py'], cwd=ROOT))
    facilities = {r['id']: r for r in ledger['places']}
    baseline_ledger = json.loads(subprocess.check_output(
        ['python3', '-B', 'tools/national/assemble.py', '--manifest',
         'data/evidence/location-batch2/hokuriku/baseline-manifest.json'], cwd=ROOT))
    baseline_facilities = {r['id']: r for r in baseline_ledger['places']}
    assert sum(not r.get('coordinate') for r in baseline_facilities.values()) == 608
    assert all(facilities[i] == baseline_facilities[i] for i in expected)
    current_unlocated = sum(not r.get('coordinate') for r in facilities.values())
    assert all(not facilities[i].get('coordinate') for i in expected)
    for row in coverage:
        assert row['reason'] and row['previousFinding']
        assert resolve(row['originalRef'])['facilityId'] == row['facilityId']
        for ref in row['reviewRefs']:
            assert resolve(ref)['facilityId'] == row['facilityId']
    outcomes = read(D / 'outcomes.json')
    assert {r['facilityId'] for r in outcomes['rows']} == selected
    assert len(outcomes['rows']) == 8 and outcomes['adoptedCount'] == 0
    assert outcomes['heldCount'] == 8 and outcomes['proposedAdoptionCount'] == 0
    import sys
    sys.path.insert(0, str(ROOT / 'tools/national'))
    from national_audit import STAGES
    for row in outcomes['rows']:
        assert row['stage'] in STAGES
        assert row['status'] == 'held' and row['coordinate'] is None
        assert row['adoptionBinding'] is None and row['stopCondition'] and row['resumeCondition']
        assert resolve(row['previousRef'])['facilityId'] == row['facilityId']
        for ref in row['sourceRefs']:
            resolve(ref)
        if 'comparisonRef' in row:
            resolve(row['comparisonRef'])
    for row in read(E / 'facts.json')['rows']:
        assert resolve(row['retrievalRef'])['id'] == row['sourceId']
    candidates = read(D / 'candidates.json')['rows']
    assert len(candidates) == outcomes['numericLeadCount'] == 3
    for row in candidates:
        assert row['facilityId'] in selected and row['decision'] == 'held'
        resolve(row['sourceRef'])
    checked = 0
    for file in ['retrievals.json', 'vector-retrievals.json', 'recheck-retrievals.json', 'recheck-vector-retrievals.json']:
        for row in read(E / file):
            if row.get('error'):
                continue
            if args.raw:
                path = ROOT / row['path']
                assert digest(path) == row['sha256'], path
                assert path.stat().st_size == row['bytes'], path
                checked += 1
    for row in read(E / 'vector-observations.json')['rows'] + read(E / 'recheck-vector-inputs.json')['rows']:
        path = ROOT / row['path']
        assert digest(path) == row['sha256'] and path.stat().st_size == row['bytes']
        assert row['candidateCoordinate'] is None
        checked += 1
    if args.raw:
        source = resolve(candidates[0]['sourceRef'])
        text = (ROOT / source['path']).read_text()
        assert '37.38892691992177' in text and '136.9041497718089' in text
        before = read(ROOT / 'data/work/location-batch2/hokuriku/before-ledger.json')
        assert baseline_ledger == before
        # This branch has no adopted pins; other regions may change the live ledger.
        if manifest_before == selection['inputSHA256']['tools/national/manifest.json']:
            assert ledger == before
    assert digest(ROOT / 'tools/national/manifest.json') == manifest_before
    print(json.dumps({'population':32, 'selected':8, 'held':8, 'adopted':0,
                      'baselineNationalUnlocated':608, 'currentNationalUnlocated':current_unlocated, 'verifiedFiles':checked,
                      'rawChecked':args.raw, 'manifestUnchanged':True}))


if __name__ == '__main__':
    main()
