"""Validate research and historical baseline separately from the current manifest."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[4]
E = Path(__file__).resolve().parent
N = ROOT / 'data/national/location-batch2/kinki-east'
sys.path.insert(0, str(ROOT / 'tools/national'))
from assemble import assemble

def read(p):
    return json.loads(Path(p).read_text())

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def resolve(ref):
    path, pointer = ref.split('#')
    value = read(ROOT / path)
    for key in pointer.strip('/').split('/'):
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value

def validate_counts(outcomes, decision):
    rows = outcomes['rows']
    assert len({r['facilityId'] for r in rows}) == len(rows), 'duplicate outcome'
    assert outcomes['selected'] == len(rows), 'selected count'
    for status in ('held', 'adopted'):
        ids = {r['facilityId'] for r in rows if r['status'] == status}
        assert ids == set(decision[status + 'Ids']), 'decision ' + status
        assert len(ids) == outcomes[status], 'outcome count ' + status

def validate_sources(rows, root, raw):
    for r in rows:
        assert r['status'] in (200, 206), 'source status'
        assert r['sourceVersion'], 'source version'
        assert r['bytes'] > 0 and len(r['sha256']) == 64, 'source bytes/hash'
        if raw:
            p = root / r['rawPath']
            assert len(p.read_bytes()) == r['bytes'], 'raw bytes ' + str(p)
            assert sha(p) == r['sha256'], 'raw hash ' + str(p)

def validate_candidates(candidates, comparisons):
    numerical = {r['key']:r for r in comparisons}
    for row in candidates:
        point = numerical[row['numericalKey']]
        assert row['coordinate'] == {'lng':point['pointLngLat'][0], 'lat':point['pointLngLat'][1]}, 'candidate coordinate'
        assert point['roundedInside'], 'candidate rounded containment'

def main(raw=False):
    selection = read(N / 'selection.json'); outcomes = read(N / 'outcomes.json')
    decision = read(N / 'decision.json'); verification = read(N / 'verification.json')
    population = {r['facilityId'] for r in read(ROOT / 'data/national/issue24/priorities-snapshot.json')['rows'] if 'kinki-east.json#' in r['originalRef']}
    assert len(population) == 38 and {r['facilityId'] for r in selection['rows']} == population
    assert len(selection['rows']) == 38
    assert population <= set(read(ROOT / 'data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
    selected = {r['facilityId'] for r in selection['rows'] if r['selection'] == 'selected'}
    assert len(selected) == 8 and selected == {r['facilityId'] for r in outcomes['rows']}
    validate_counts(outcomes, decision)
    candidates = read(N / 'candidates.json')['rows']
    assert len(candidates) == outcomes['proposed']
    assert {r['facilityId'] for r in candidates} <= selected
    validate_candidates(candidates, read(E / 'numerical-comparisons.json'))
    for candidate in candidates:
        assert resolve(candidate['identityRef'])['facilityId'] == candidate['facilityId']
    assert outcomes['updates'] == read(N / 'locations.json')['updates']
    assert decision['manifestChanged'] and len(decision['bindings']) == 2
    approved = read(N / 'approved-candidates.json')
    assert approved['rows'] == candidates and approved['originalCandidatesSHA256'] == sha(N / 'candidates.json')
    review = read(N / 'gemini-flash-review.json')
    assert set(review['approvedIds']) == set(decision['adoptedIds'])
    assert sha(ROOT / review['rawReport']) == review['rawReportSHA256']
    for p, digest in selection['inputSHA256'].items():
        source = E / 'baseline-manifest.json' if p == 'tools/national/manifest.json' else ROOT / p
        assert sha(source) == digest, p
    for row in selection['rows']:
        assert resolve(row['originalRef'])['facilityId'] == row['facilityId'] and row['reason']
    facts = read(E / 'adoption-evidence.json')['rows']
    assert {r['facilityId'] for r in facts} == set(decision['adoptedIds'])
    for fact in facts:
        for key in ('numericalEvidence', 'vectorSource'):
            assert sha(ROOT / fact[key]['path']) == fact[key]['sha256']
        for source in fact['sourceEvidence']:
            assert resolve(source['reference'])['sha256'] == source['snapshotSHA256']
        assert fact['coordinate'] == next(c['coordinate'] for c in candidates if c['facilityId'] == fact['facilityId'])
    sources = read(E / 'retrievals.json') + read(E / 'revision-retrievals.json')
    validate_sources(sources, ROOT, raw)
    for row in outcomes['rows']:
        assert row['status'] in ('held', 'adopted')
        if row['status'] == 'held': assert row['coordinate'] is None
        else: assert row['coordinate'] == next(c['coordinate'] for c in candidates if c['facilityId'] == row['facilityId'])
        assert row['resumeCondition'] and row['stopCondition'] and row['performedMethod']
        for evidence in row['evidence']:
            source = resolve(evidence['reference'])
            for a,b in [('sha256','snapshotSHA256'),('url','sourceUrl'),('rawPath','rawPath'),('fetchedAt','fetchedAt')]:
                assert source[a] == evidence[b], evidence['reference']
    if raw:
        for r in read(E / 'rendering.json')['files']:
            assert sha(ROOT / r['path']) == r['sha256'], r['path']
    for site in read(E / 'vector-acquisition.json')['sites']:
        for tile in site['tiles']:
            assert sha(ROOT / tile['rawPath']) == tile['sha256']
            assert (ROOT / tile['rawPath']).stat().st_size == tile['bytes']
    baseline, _ = assemble(ROOT, read(E / 'baseline-manifest.json'))
    old = {p['id']:p for p in baseline['places']}
    assert sum(not p.get('coordinate') for p in old.values()) == verification['nationalRegisteredUnlocated'] == 608
    assert sha(E / 'baseline-manifest.json') == verification['manifestSHA256']
    digest = hashlib.sha256(json.dumps(baseline, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    assert digest == verification['assembledSHA256']
    assert verification['population'] == 38 and verification['selected'] == 8
    manifest = read(ROOT / 'tools/national/manifest.json')
    ledger, _ = assemble(ROOT, manifest)
    before_manifest = copy.deepcopy(manifest)
    for key in ('locations','locationLifecycle'):
        before_manifest[key] = [s for s in before_manifest[key] if not s['path'].startswith('data/national/location-batch2/kinki-east/')]
    before, _ = assemble(ROOT, before_manifest)
    previous = {p['id']:p for p in before['places']}
    current = {p['id']:p for p in ledger['places']}
    assert previous.keys() == current.keys() and before['relations'] == ledger['relations']
    adopted = set(decision['adoptedIds'])
    for fid in previous:
        if fid not in adopted: assert previous[fid] == current[fid]
        else:
            assert {k:v for k,v in current[fid].items() if k not in ('coordinate','evidence','locationReview')} == {k:v for k,v in previous[fid].items() if k != 'evidence'}
            assert current[fid]['locationReview']['status'] == 'confirmed'
    for r in read(N / 'prior-values.json')['rows']:
        assert r['previousPlace'] == previous[r['facilityId']]
        assert hashlib.sha256(json.dumps(r['previousPlace'],sort_keys=True,ensure_ascii=False).encode()).hexdigest() == r['previousPlaceSHA256']
        assert resolve(r['originalRef']) == r['originalRow']
    result = {'population':38, 'selected':8, 'adopted':2, 'held':6, 'sources':len(sources), 'rawChecked':raw,
              'historicalRegisteredUnlocated':608,
              'withoutOwnAdoptionRegisteredUnlocated':sum(not p.get('coordinate') for p in previous.values()),
              'currentRegisteredUnlocated':sum(not p.get('coordinate') for p in current.values()),
              'otherPlacesAndAllRelationsUnchanged':True}
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--raw', action='store_true')
    main(parser.parse_args().raw)
