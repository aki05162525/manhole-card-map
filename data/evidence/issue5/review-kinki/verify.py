"""Read-only independent checks; run from repository root. No candidate regeneration."""
import hashlib
import html
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path('data/evidence/issue5/review-kinki')
def read(p):
    return json.loads(Path(p).read_text())
def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def verify():
    candidate = read('data/national/issue5/kinki.json')
    ledger = read('data/work/issue5-baseline/ledger.json')
    full = read('data/work/issue5-baseline/full.json')
    places = {p['id']: p for p in ledger['places']}
    region_relations = [r for r in ledger['relations'] if 24 <= int(r['cardId'][:2]) <= 30]
    targets = {r['placeId'] for r in region_relations if not places[r['placeId']].get('coordinate')}
    classified = [r['facilityId'] for r in candidate['updates'] + candidate['unresolved']]
    assert len(classified) == len(set(classified)) == len(targets) == 192
    assert set(classified) == targets
    assert len(candidate['updates']) == 4 and len(candidate['unresolved']) == 188
    assert {r['cardId'] for r in region_relations} <= {c['id'] for c in full['cards']}
    for e in read('data/evidence/issue5/kinki/reused-sources.json'):
        assert sha(e['snapshotPath']) == e['snapshotSHA256'] == sha(e['reusedFrom'])
    for e in read('data/evidence/issue5/kinki/fetch-log.json'):
        if e.get('snapshotPath'):
            assert sha(e['snapshotPath']) == e['snapshotSHA256']
    for e in read('data/evidence/issue5/kinki/validation.json')['inputs']:
        assert sha(e['path']) == e['sha256']
    coordinates = []
    for index, u in enumerate(candidate['updates']):
        evidence = u['evidence']
        assert sha(evidence['snapshotPath']) == evidence['snapshotSHA256']
        raw = Path(evidence['snapshotPath']).read_text()
        if index == 0:
            settings = re.search(r'<script type="application/json" data-map-view-target="setting">\s*(.*?)\s*</script>', raw, re.S)
            marker = next(m for m in json.loads(settings[1])['markerInfos'] if m['title'] == '水道局')
            pair = (marker['lat'], marker['lng'])
        elif index == 1:
            url = next(html.unescape(s) for s in re.findall(r'href="([^"]+)"', raw) if 'maps.google.co.jp/maps?q=' in s)
            query = parse_qs(urlsplit(url).query)
            pair = tuple(map(float, query['q'][0].split(',')))
            assert pair != tuple(map(float, query['ll'][0].split(',')))
        elif index == 2:
            pair = tuple(map(float, re.search(r'var latlng = \[([^\]]+)\]', raw)[1].split(',')))
            assert 'L.marker(latlng, {icon: icon}).addTo(mapCanvas).bindPopup(popup)' in raw
            assert 'mapInfoWindowTitle">豊能町役場' in raw
        else:
            section = raw[raw.index('配布場所'):raw.index('カードデザイン')]
            match = re.search(r'!3d([\d.]+)!4d([\d.]+)', section)
            pair = tuple(map(float, match.groups()))
            center = tuple(map(float, re.search(r'@([\d.]+),([\d.]+),', section).groups()))
            assert pair != center
        assert pair == (u['coordinate']['lat'], u['coordinate']['lng'])
        assert u['scope'] == 'building' and not places[u['facilityId']].get('coordinate')
        relations = [r for r in region_relations if r['placeId'] == u['facilityId']]
        assert len(relations) == 1
        full_relations = [r for r in full['relations'] if r['placeId'] == u['facilityId']]
        assert [(r['cardId'], r['status']) for r in relations] == [(r['cardId'], r['status']) for r in full_relations]
        if index == 1:
            assert relations[0]['status'] == 'suspended'
        coordinates.append({'facilityId': u['facilityId'], 'extracted': list(pair), 'cardId': relations[0]['cardId'], 'status': relations[0]['status']})
    correction = candidate['corrections'][0]
    old = read(correction['targetPath'])
    row = next(r for r in old['unresolved'] if r['facilityId'] == correction['facilityId'])
    assert row['reason'] == correction['old']
    raw = Path(correction['evidence']['snapshotPath']).read_text()
    assert sha(correction['evidence']['snapshotPath']) == correction['evidence']['snapshotSHA256']
    url = next(html.unescape(s) for s in re.findall(r'href="([^"]+)"', raw) if 'id=1000001826' in s)
    query = parse_qs(urlsplit(url).query)
    assert float(query['lat'][0]) == 34.971 and float(query['lng'][0]) == 135.75614
    assert correction['facilityId'] not in {u['facilityId'] for u in candidate['updates']}
    return {'targetCount': 192, 'updateCount': 4, 'unresolvedCount': 188, 'reusedHashesVerified': 125, 'coordinates': coordinates, 'kyotoOldExactMatch': True, 'kyotoCoordinateUnadopted': True}

if __name__ == '__main__':
    result = verify()
    review_path = Path('data/national/issue5/reviews/kinki.json')
    if review_path.exists():
        review = read(review_path)
        for entry in review['inputs']:
            assert sha(entry['path']) == entry['sha256'], entry['path']
        candidate = read('data/national/issue5/kinki.json')
        for r in review['reviews']:
            u = next(u for u in candidate['updates'] if u['facilityId'] == r['facilityId'])
            assert r['coordinate'] == u['coordinate']
            for edit in r['exactCorrections']:
                if edit['targetPath'] == 'data/national/issue5/kinki.json':
                    assert u['evidence']['sourceLocator'] == edit['old']
    print(json.dumps(result, ensure_ascii=False, indent=2))
