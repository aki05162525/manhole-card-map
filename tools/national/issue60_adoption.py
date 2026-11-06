"""Reproduce only the explicitly approved Issue60 subset from frozen inputs."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from assemble import assemble, read_json
from issue76_adoption import prepare_county
from location_lifecycle import digest

SOURCE = 'data/evidence/issue60/human-answers-20261106/round2'
ASSESSMENT_HASH = 'b7f232a659f06f524b46c7ade69c0d4316459e5ce57cd548d7ce2597f25d55d2'


def prepare(root):
    source = root / SOURCE
    review = read_json(source / 'adoption-review.json')
    outcomes = read_json(source / 'assessment.json')['outcomes']
    candidates = read_json(source / 'locations-proposed.json')['updates']
    inputs = read_json(source / 'review-inputs.json')
    assert digest(outcomes) == review['assessmentSHA256'] == ASSESSMENT_HASH
    assert review['status'] == 'approved-subset'
    selected = set(review['approvedIds'])
    assert len(selected) == 15 and not selected.intersection(review['heldIds'])
    rows = [copy.deepcopy(r) for r in outcomes if r['facilityId'] in selected]
    assert {r['number'] for r in rows} == {1, 2, 3, 4, 5, 9, 15, 17, 26, 28, 31, 33, 34, 37, 47}
    for row in rows:
        candidate = next(c for c in candidates if c['facilityId'] == row['facilityId'])
        assert digest(candidate) == row['sourceLocationSHA256'] == review['approvedCandidateSHA256'][row['facilityId']]
        # Derive the version description from the approved method, including mapped diagrams.
        row['sourceVersion'] = row['adoptionMethod'] + ' 採用レビュー2026-11-06。'
    common = copy.deepcopy(inputs['common'])
    assert digest(common) == review['commonSHA256']
    for name in ('assessment.json', 'locations-proposed.json', 'review-inputs.json', 'adoption-review.json'):
        common['files'][f'{SOURCE}/{name}'] = hashlib.sha256((source / name).read_bytes()).hexdigest()
    result = {}
    for county in sorted({r['county'] for r in rows}):
        subset = [r for r in rows if r['county'] == county]
        prefix = f'data/national/issue76/{county}/human-followup'
        old = f'data/national/issue76/{county}/assessment.json'
        binding = dict(originalAssessmentPath=f'{SOURCE}/assessment.json',
                       originalAssessmentSHA256=ASSESSMENT_HASH,
                       approvalPath=f'{SOURCE}/adoption-review.json',
                       approvedCandidateSHA256={r['facilityId']: r['sourceLocationSHA256'] for r in subset})
        result[f'{prefix}/assessment.json'] = dict(schema=1, county=county, assessmentDate='2026-11-06',
            supersedes=dict(assessmentPath=old, assessmentSHA256=hashlib.sha256((root / old).read_bytes()).hexdigest()),
            subsetApproval=binding, outcomes=subset)
        result[f'{prefix}/review-inputs.json'] = dict(schema=1, assessmentPath=f'{prefix}/assessment.json',
            assessmentSHA256=digest(subset), common=common, commonSHA256=digest(common))
        result[f'{prefix}/review.json'] = dict(schema=1, status='approved', reviewer=review['reviewer'],
            reviewedAt=review['reviewedAt'], evidence=[f'{SOURCE}/adoption-review.json'],
            assessmentSHA256=digest(subset), commonSHA256=digest(common),
            approvedIds=[r['facilityId'] for r in subset], subsetApproval=binding,
            scope='固定47評価の独立承認15件だけを県別に整理。再審査・追加承認ではない。outcomesのadoptionApproved/nextActionは原評価時点の履歴。sourceVersionは承認済みadoptionMethodから導出。')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    manifest_path = root / 'tools/national/manifest.json'
    manifest = read_json(manifest_path)
    baseline_manifest = copy.deepcopy(manifest)
    for key in ('locations', 'locationLifecycle'):
        baseline_manifest[key] = [r for r in manifest[key] if '/human-followup/' not in r['path']]
    baseline, _ = assemble(root, baseline_manifest)
    def output(path, data):
        encoded = (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode()
        file = root / path
        if args.check:
            assert file.read_bytes() == encoded, path
        else:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(encoded)
        return hashlib.sha256(encoded).hexdigest()
    packages = prepare(root)
    for path, data in packages.items():
        output(path, data)
    for path in packages:
        if not path.endswith('/assessment.json'):
            continue
        prefix = str(Path(path).parent)
        county = prefix.removeprefix('data/national/issue76/')
        locations, lifecycle, provenance = prepare_county(root, county, baseline)
        location_hash = output(f'{prefix}/locations.json', locations)
        lifecycle_hash = output(f'{prefix}/location-lifecycle.json', lifecycle)
        output(f'{prefix}/adoption-provenance.json', provenance)
        for key, entry in [
            ('locations', dict(path=f'{prefix}/locations.json', sha256=location_hash,
                approved=[dict(facilityId=r['facilityId'], sha256=digest(r)) for r in locations['updates']])),
            ('locationLifecycle', dict(path=f'{prefix}/location-lifecycle.json', sha256=lifecycle_hash))]:
            baseline_manifest[key].append(entry)
    if args.check:
        assert manifest == baseline_manifest
    else:
        output('tools/national/manifest.json', baseline_manifest)


if __name__ == '__main__':
    main()
