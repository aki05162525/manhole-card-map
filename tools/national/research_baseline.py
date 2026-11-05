"""Keep a frozen batch2 research baseline separate from today's regional delta."""
import copy
import hashlib
import json

from assemble import assemble, read_json

# This existing snapshot has the exact manifest bytes recorded by the three
# research-only regions at f66b7e994ef250fadee78f396d22fdfc40ba6a83.
# Its hash is checked against each selection, never updated from today's manifest.
BASELINE_MANIFEST = 'data/evidence/location-batch2/hokuriku/baseline-manifest.json'


def serialized(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()


def check_research_only(root, region, selection, ledger_snapshot):
    hashes = selection['inputSHA256']
    baseline_path = root / BASELINE_MANIFEST
    if hashlib.sha256(baseline_path.read_bytes()).hexdigest() != hashes['tools/national/manifest.json']:
        raise ValueError('baseline manifest hash mismatch')
    baseline, _ = assemble(root, read_json(baseline_path))
    if hashlib.sha256(serialized(baseline)).hexdigest() != hashes[ledger_snapshot]:
        raise ValueError('baseline ledger hash mismatch')

    manifest = read_json(root / 'tools/national/manifest.json')
    regional_before = copy.deepcopy(manifest)
    prefix = f'data/national/location-batch2/{region}/'
    for key in ('patches', 'locations', 'locationLifecycle'):
        regional_before[key] = [row for row in regional_before.get(key, [])
                                if not row['path'].startswith(prefix)]
    regional_before['inputs'] = [path for path in regional_before.get('inputs', []) if not path.startswith(prefix)]
    before, _ = assemble(root, regional_before)
    current, _ = assemble(root, manifest)
    # Compare every field/relation, including changes outside selected facilities.
    # Other regions remain in both inputs and cannot invalidate this comparison.
    if before != current:
        raise ValueError('research-only regional ledger changed')
    return baseline, current, {
        'baselineNationalUnlocated': sum(not p.get('coordinate') for p in baseline['places']),
        'currentNationalUnlocated': sum(not p.get('coordinate') for p in current['places']),
        'currentRegionalChangedIds': [],
    }
