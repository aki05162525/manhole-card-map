"""Package the independently approved Kinugasa office without changing research."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from assemble import assemble, read_json
from issue76_adoption import prepare_county
from location_lifecycle import digest

SOURCE = 'data/evidence/issue60/kinugasa-followup'
PREFIX = 'data/national/issue76/kanagawa/kinugasa-followup'
FID = 'facility:kanto-south-ec19477e52b814868f78'


def prepare(root):
    approval = read_json(root / SOURCE / 'adoption-review.json')
    assert approval['status'] == 'approved' and approval['approvedIds'] == [FID]
    for path, expected in approval['preservedInputs'].items():
        assert hashlib.sha256((root / path).read_bytes()).hexdigest() == expected, path
    candidate_path = f'{SOURCE}/original/kanagawa/locations-proposed.json'
    candidate, = read_json(root / candidate_path)['updates']
    assert candidate['facilityId'] == FID
    compact = hashlib.sha256(json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert compact == approval['candidateCompactSHA256'] == '58f5d1f71b0c355d1801c911c6c3b066ad797bd78056c368af2d585ff062be82'
    assert digest(candidate) == approval['candidateAssemblySHA256'] == '08870f6707008fc2cc8d72483b17837a1518ce58212ab4b9ef440d5f7a451b35'
    original = read_json(root / SOURCE / 'original/kanagawa/assessment.json')
    row = copy.deepcopy(next(r for r in original['rows'] if r['facilityId'] == FID))
    assert row['candidate'] == candidate and row['recommendation'] == 'propose'
    row.update(county='kanagawa', sourceLocationPath=candidate_path,
        sourceLocationSHA256=digest(candidate), nextAction='承認済み1件を採用。',
        adoptionMethod='国土地理院最適化ベクトルタイルBldA589の代表内点を加工。',
        sourceVersion='optimal_bvmap-v1; BldA589; Issue60 independent approval 2026-11-06')
    row['positionSuitability']['evidence'] = [p.replace('/tmp/issue60-recheck-six', f'{SOURCE}/original') for p in row['positionSuitability']['evidence']]
    old = 'data/national/issue76/kanagawa/assessment.json'
    common = copy.deepcopy(read_json(root / 'data/national/issue76/kanagawa/review-inputs.json')['common'])
    assert digest(common) == approval['commonSHA256'] == '4624a179b682670e776eae22c94f45f6820a87825e7e41b2def49daaf159a7b6'
    for path in sorted((root / SOURCE).rglob('*')):
        if path.is_file():
            common['files'][path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    binding = dict(approvalPath=f'{SOURCE}/adoption-review.json', originalAssessmentPath=f'{SOURCE}/original/kanagawa/assessment.json', originalAssessmentSHA256=digest(original['rows']), approvedCandidateSHA256={FID:digest(candidate)}, transformation='Only county/source bindings, adoption metadata and repository evidence paths added. Original row/candidate bytes retained.')
    rows = [row]
    return {
        f'{PREFIX}/assessment.json':dict(schema=1,county='kanagawa',assessmentDate='2026-11-06',supersedes=dict(assessmentPath=old,assessmentSHA256=hashlib.sha256((root/old).read_bytes()).hexdigest()),subsetApproval=binding,outcomes=rows),
        f'{PREFIX}/review-inputs.json':dict(schema=1,assessmentPath=f'{PREFIX}/assessment.json',assessmentSHA256=digest(rows),common=common,commonSHA256=digest(common)),
        f'{PREFIX}/review.json':dict(schema=1,status='approved',reviewer=approval['reviewer'],reviewedAt=approval['reviewedAt'],evidence=[f'{SOURCE}/adoption-review.json'],assessmentSHA256=digest(rows),commonSHA256=digest(common),approvedIds=[FID],subsetApproval=binding,scope='Parent handoff approval packaged for adoption; no new adoption judgment. Common hash extends unchanged reviewed common with preserved inputs.')}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[2]
    manifest=read_json(root/'tools/national/manifest.json')
    base=copy.deepcopy(manifest)
    for key in ('locations','locationLifecycle'):
        base[key]=[r for r in base[key] if not r['path'].startswith(PREFIX+'/')]
    baseline,_=assemble(root,base)
    def output(path,data):
        encoded=(json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode()
        target=root/path
        if args.check:
            assert target.read_bytes()==encoded,path
        else:
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(encoded)
        return hashlib.sha256(encoded).hexdigest()
    for path,data in prepare(root).items():
        output(path,data)
    locations,lifecycle,provenance=prepare_county(root,'kanagawa/kinugasa-followup',baseline)
    lh=output(f'{PREFIX}/locations.json',locations)
    bh=output(f'{PREFIX}/location-lifecycle.json',lifecycle)
    output(f'{PREFIX}/adoption-provenance.json',provenance)
    base['locations'].append(dict(path=f'{PREFIX}/locations.json',sha256=lh,approved=[dict(facilityId=FID,sha256=digest(locations['updates'][0]))]))
    base['locationLifecycle'].append(dict(path=f'{PREFIX}/location-lifecycle.json',sha256=bh))
    # Keep historical fixed-15 regeneration order (human-followup entries last).
    for key in ('locations', 'locationLifecycle'):
        base[key] = ([r for r in base[key] if '/human-followup/' not in r['path']] +
                     [r for r in base[key] if '/human-followup/' in r['path']])
    if args.check:
        assert manifest==base
    else:
        output('tools/national/manifest.json',base)

if __name__ == '__main__':
    main()
