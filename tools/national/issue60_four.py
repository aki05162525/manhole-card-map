"""Reproduce four approvals from preserved heterogeneous research inputs."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from assemble import assemble, read_json
from issue76_adoption import prepare_county
from location_lifecycle import digest

SOURCE = 'data/evidence/issue60/four-followup'
SUFFIX = '/four-followup/'
COMMON_HASH = '4624a179b682670e776eae22c94f45f6820a87825e7e41b2def49daaf159a7b6'


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(root):
    approval = read_json(root / SOURCE / 'adoption-review.json')
    preserved = read_json(root / SOURCE / 'preserved-inputs.json')
    assert approval['status'] == 'approved' and len(approval['approved']) == 4
    assert {r['number'] for r in approval['approved']} == {8, 10, 30, 36}
    for item in preserved.values():
        assert file_hash(root / item['savedPath']) == item['sha256'], item['savedPath']
    common = copy.deepcopy(read_json(root / 'data/national/issue76/kanagawa/review-inputs.json')['common'])
    assert digest(common) == approval['commonSHA256'] == COMMON_HASH
    for path in sorted((root / SOURCE).rglob('*')):
        if path.is_file():
            common['files'][path.relative_to(root).as_posix()] = file_hash(path)
    packages, by_county, transformations = {}, {}, []
    for approved in approval['approved']:
        group, number, fid = (approved[k] for k in ('group', 'number', 'facilityId'))
        original = f'{SOURCE}/original/{group}'
        candidate_name = 'candidate.json' if group == 'tokyo' else 'candidates.json'
        candidate_path = f'{original}/{candidate_name}'
        raw_candidates = read_json(root / candidate_path)
        candidates = raw_candidates['updates'] if isinstance(raw_candidates, dict) else raw_candidates
        wrapper = next(r for r in candidates if r['number'] == number)
        raw = wrapper
        assert digest(raw) == approved['rawCandidateSHA256']
        assert raw['facilityId'] == fid and raw['coordinate'] == approved['coordinate']
        raw_assessment = read_json(root / original / 'assessment.json')
        outcomes = raw_assessment['outcomes'] if isinstance(raw_assessment, dict) else raw_assessment
        assert file_hash(root / original / 'assessment.json') == approved['assessmentFileSHA256']
        assessed = next(r for r in outcomes if r['facilityId'] == fid)
        county = 'tokyo' if group == 'tokyo' else 'saitama'
        prefix = f'data/national/issue76/{county}/four-followup'
        method = '国土地理院最適化ベクトルタイルの保存数値外形から建物代表点を加工。原研究座標を保持。受付用途は利用者報告、棟対応は原資料と独立レビューの判断。境界余裕は絶対精度の保証ではない。'
        # A normalized update is distinct from its immutable approved research row.
        ev = dict(sourceUrl='https://github.com/gsi-cyberjapan/optimal_bvmap',
                  snapshotPath=candidate_path, snapshotSHA256=file_hash(root / candidate_path),
                  sourceLocator=f'number={number}; approved research SHA256={digest(raw)}; 国土地理院資料を加工。',
                  checkedAt=raw['checkedAt'], actorType='ai', verificationMethod=method)
        update = dict(facilityId=fid, coordinate=copy.deepcopy(raw['coordinate']), scope='building', expectedOldCoordinate=None, evidence=ev)
        path = f'{prefix}/candidates.json'
        packages.setdefault(path, dict(schema=1, updates=[]))['updates'].append(update)
        row = dict(number=number, facilityId=fid, county=county, recommendation='propose',
                   positionSuitability=dict(status='acceptable', buildingAssessment=copy.deepcopy(assessed),
                       uncertainty=copy.deepcopy(wrapper.get('uncertainty', raw.get('uncertainty'))),
                       evidence=[f'{original}/assessment.json', candidate_path]),
                   originalAssessment=copy.deepcopy(assessed), originalResearch=copy.deepcopy(wrapper),
                   sourceLocationPath=path, sourceLocationSHA256=digest(update),
                   adoptionMethod=method, sourceVersion=method+' 採用レビュー2026-11-06。',
                   nextAction='親引継ぎによる独立承認済み4件の採用。配布関係の更新は対象外。')
        by_county.setdefault(county, []).append(row)
        transformations.append(dict(facilityId=fid, number=number, rawPath=candidate_path,
            rawSelector=f'updates[number={number}]' if group == 'tokyo' else f'[number={number}]',
            rawCandidateSHA256=digest(raw), normalizedPath=path, normalizedCandidateSHA256=digest(update), coordinate=raw['coordinate']))
    packages['data/evidence/issue60/four-transformations.json'] = dict(schema=1, rows=transformations,
        scope='Raw bytes retained; normalize facilityId/coordinate/scope/expectedOldCoordinate/evidence only. Coordinates unchanged; final adoption hashes are in location-lifecycle adoptionSHA256 and manifest; join by facilityId.')
    for county, rows in by_county.items():
        prefix = f'data/national/issue76/{county}/four-followup'
        old = f'data/national/issue76/{county}/assessment.json'
        binding = dict(approvalPath=f'{SOURCE}/adoption-review.json', approvedCandidateSHA256={r['facilityId']:r['sourceLocationSHA256'] for r in rows}, transformationPath='data/evidence/issue60/four-transformations.json')
        packages[f'{prefix}/assessment.json'] = dict(schema=1,county=county,assessmentDate='2026-11-06',
            supersedes=dict(assessmentPath=old,assessmentSHA256=file_hash(root/old)),subsetApproval=binding,outcomes=rows)
        packages[f'{prefix}/review-inputs.json'] = dict(schema=1,assessmentPath=f'{prefix}/assessment.json',assessmentSHA256=digest(rows),common=common,commonSHA256=digest(common))
        packages[f'{prefix}/review.json'] = dict(schema=1,status='approved',reviewer=approval['reviewer'],reviewedAt=approval['reviewedAt'],
            evidence=[f'{SOURCE}/adoption-review.json'],assessmentSHA256=digest(rows),commonSHA256=digest(common),approvedIds=[r['facilityId'] for r in rows],subsetApproval=binding,
            scope='Parent approval handoff, not a new review. Raw pending/unapproved language is historical. Normalized rows bind those approvals to unchanged coordinates.')
    return packages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    manifest = read_json(root / 'tools/national/manifest.json')
    base = copy.deepcopy(manifest)
    for key in ('locations', 'locationLifecycle'):
        base[key] = [r for r in base[key] if SUFFIX not in r['path']]
    baseline, _ = assemble(root, base)
    def output(path, data):
        encoded = (json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode()
        target = root / path
        if args.check:
            assert target.read_bytes() == encoded, path
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(encoded)
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
        lh = output(f'{prefix}/locations.json',locations)
        bh = output(f'{prefix}/location-lifecycle.json',lifecycle)
        output(f'{prefix}/adoption-provenance.json',provenance)
        base['locations'].append(dict(path=f'{prefix}/locations.json',sha256=lh,approved=[dict(facilityId=r['facilityId'],sha256=digest(r)) for r in locations['updates']]))
        base['locationLifecycle'].append(dict(path=f'{prefix}/location-lifecycle.json',sha256=bh))
    # Insert this independent package before older followups so their existing
    # regeneration commands retain manifest order without any code changes.
    for key in ('locations', 'locationLifecycle'):
        base[key].sort(key=lambda r: -1 if SUFFIX in r['path'] else 2 if '/human-followup/' in r['path'] else 1 if '/kinugasa-followup/' in r['path'] else 0)
    if args.check:
        assert manifest == base
    else:
        output('tools/national/manifest.json',base)


if __name__ == '__main__':
    main()
