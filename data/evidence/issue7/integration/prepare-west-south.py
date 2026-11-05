"""Prepare exact reviewed date and address corrections without modifying sources."""
import json
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text())


def write(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


source = 'data/national/issue7/kyushu-okinawa.json'
data = read(source)
review = read('data/national/issue7/reviews/kyushu-okinawa.json')
for correction in review['exactCorrections']:
    assert correction['targetPath'] == source
    keys = correction['jsonPointer'].strip('/').split('/')
    target = data
    for key in keys[:-1]:
        target = target[int(key)] if isinstance(target, list) else target[key]
    assert target[keys[-1]] == correction['old']
    target[keys[-1]] = correction['new']
write('data/national/issue7/kyushu-okinawa-reviewed.json', data)
manifest = read('tools/national/manifest.json')
inputs = {p: read(p) for p in manifest['inputs']}
patches = []


def address_patch(correction, evidence):
    fid = correction['facilityId']
    matches = [(p, row) for p, ledger in inputs.items()
               for row in ledger['places'] if row['id'] == fid]
    assert len(matches) == 1, fid
    path, row = matches[0]
    assert row['address'] == correction['old']
    patches.append(dict(file=path, collection='places', match={'id': fid},
                        field='address', old=correction['old'], new=correction['new'],
                        evidence=evidence))


address_patch(data['corrections'][0], data['corrections'][0]['evidence'])
tokai = read('data/national/issue7/reviews/tokai.json')
for correction in tokai['corrections']:
    if correction.get('targetPath') != 'data/work/issue7-baseline/ledger.json':
        continue
    assert correction['status'] == 'accepted'
    b = correction['basis']
    ev = dict(sourceUrl=b['url'], snapshotPath=b['snapshotPath'],
              snapshotSHA256=b['snapshotSHA256'], sourceLocator=b['sourceLocator'],
              checkedAt='2026-11-05', actorType='ai',
              verificationMethod=correction['reviewReason'])
    address_patch(correction, ev)
assert len(patches) == 3
write('data/national/issue7/address-reviewed-patches.json', {'schema': 1, 'patches': patches})
print('Prepared corrected Kyushu evidence and 3 reviewed address patches')
