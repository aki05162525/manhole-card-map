"""Bind the two photo-derived candidates to the explicit independent approval."""
import argparse
import json
import copy
import hashlib
from pathlib import Path
from assemble import assemble, read_json
from issue76_adoption import prepare_county
from location_lifecycle import digest

SOURCE='data/evidence/issue60/photo-resolution'
SUFFIX='/photo-resolution/'
def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare(root):
    approval=read_json(root/SOURCE/'adoption-review.json')
    assert approval['status']=='approved' and approval['reviewer']=='independent-codex-e0bc6ec7'
    assert {r['number'] for r in approval['approved']}=={43,45}
    for item in read_json(root/SOURCE/'preserved-inputs.json').values():
        assert file_hash(root/item['savedPath'])==item['sha256'],item['savedPath']
    original=f'{SOURCE}/original'
    for filename,count in [('input-hashes.json',35),('artifact-hashes.json',52)]:
        hashes=read_json(root/original/filename)
        assert len(hashes)==count
        for path,sha in hashes.items(): assert file_hash(root/original/path)==sha,path
    common=copy.deepcopy(read_json(root/'data/national/issue76/kanagawa/review-inputs.json')['common'])
    for path in sorted((root/SOURCE).rglob('*')):
        if path.is_file(): common['files'][path.relative_to(root).as_posix()]=file_hash(path)
    conditions=read_json(root/original/'source-conditions.json')
    raw_rows=read_json(root/original/'candidates.json')
    packages={};transformations=[]
    for approved in approval['approved']:
        number,fid=approved['number'],approved['facilityId']
        raw=next(r for r in raw_rows if r['number']==number)
        assert digest(raw)==approved['rawCandidateSHA256']
        assert raw['facilityId']==fid and raw['coordinate']==approved['coordinate']
        assert not raw['standardMapUsedForFit'] and raw['oldCoordinatesUsedOnlyForDifference']
        county={43:'tochigi',45:'gunma'}[number]
        prefix=f'data/national/issue76/{county}/photo-resolution'
        photo=conditions[f'photo{number}']
        method=conditions['attribution']+f" 写真: {photo['dataSource']}、{photo['date']}。{photo['numericUse']}"
        method+=' 数値基準はseamlessphoto。標準地図の旧制御点・旧行列はfit不使用、旧点は差の比較のみ。絶対精度上限は未確定。基本測量成果以外・出典記載で申請不要という公開条件の適用判断を独立承認。提供者の個別許諾取得ではない。'
        path=f'{prefix}/candidates.json'
        ev=dict(sourceUrl=conditions['catalogue']['url'],snapshotPath=f'{original}/candidates.json',snapshotSHA256=file_hash(root/original/'candidates.json'),sourceLocator=f'No{number}; approved row SHA256={digest(raw)}; {conditions["attribution"]}',checkedAt='2026-11-06',actorType='ai',verificationMethod=method)
        update=dict(facilityId=fid,coordinate=raw['coordinate'],scope='building',expectedOldCoordinate=None,evidence=ev)
        packages[path]=dict(schema=1,updates=[update])
        row=dict(number=number,facilityId=fid,county=county,recommendation='propose',positionSuitability=dict(status='acceptable',buildingAssessment=raw,uncertainty=raw['readingSensitivity'],evidence=[f'{original}/candidates.json',f'{original}/source-conditions.json']),originalResearch=raw,sourceLocationPath=path,sourceLocationSHA256=digest(update),adoptionPointDescription='建物代表点',adoptionMethod=method,sourceVersion=method,nextAction='独立レビューe0bc6ec7の承認範囲を採用。配布関係の変更なし。')
        rows=[row];old=f'data/national/issue76/{county}/assessment.json'
        binding=dict(approvalPath=f'{SOURCE}/adoption-review.json',approvedCandidateSHA256={fid:digest(update)})
        packages[f'{prefix}/assessment.json']=dict(schema=1,county=county,assessmentDate='2026-11-06',supersedes=dict(assessmentPath=old,assessmentSHA256=file_hash(root/old)),subsetApproval=binding,outcomes=rows)
        packages[f'{prefix}/review-inputs.json']=dict(schema=1,assessmentPath=f'{prefix}/assessment.json',assessmentSHA256=digest(rows),common=common,commonSHA256=digest(common))
        packages[f'{prefix}/review.json']=dict(schema=1,status='approved',reviewer=approval['reviewer'],reviewedAt=approval['reviewedAt'],evidence=[f'{SOURCE}/adoption-review.json'],assessmentSHA256=digest(rows),commonSHA256=digest(common),approvedIds=[fid],subsetApproval=binding,scope='Parent independent approval handoff. Raw pending/publicAdoptionApproved=false fields remain historical; no new review inferred.')
        transformations.append(dict(number=number,facilityId=fid,rawPath=f'{original}/candidates.json',rawCandidateSHA256=digest(raw),normalizedPath=path,normalizedCandidateSHA256=digest(update),coordinate=raw['coordinate']))
    packages['data/evidence/issue60/photo-transformations.json']=dict(schema=1,rows=transformations)
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
    if args.check:
        assert manifest == base
    else:
        output('tools/national/manifest.json',base)


if __name__ == '__main__':
    main()
