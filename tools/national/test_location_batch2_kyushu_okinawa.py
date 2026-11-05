"""Exact regional adoption delta; preserve all other regions and historical tests."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
import assemble

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/kyushu-okinawa/'
POINTS = {
    'facility:ws-f5ea517afaab927bb9': {'lat': 27.338544, 'lng': 128.5738394},
    'facility:kyushu-0457cc860e34e1f5a582': {'lat': 32.8452193, 'lng': 130.0523047},
    'facility:kyushu-7a9f8dae19665147953f': {'lat': 27.726407, 'lng': 129.0186019},
    'facility:ws-61c944585418f01447': {'lat': 27.726407, 'lng': 129.0186019},
    'facility:kyushu-5adca0ddeb2263d545e6': {'lat': 26.3324282, 'lng': 127.8808337},
}

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

class KyushuOkinawaBatch2Tests(unittest.TestCase):
    def test_exact_five_facilities_four_buildings_and_three_holds(self):
        manifest = assemble.read_json(ROOT / 'tools/national/manifest.json')
        baseline = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            baseline[key] = [r for r in baseline[key] if not r['path'].startswith(PREFIX)]
        before, _ = assemble.assemble(ROOT, baseline)
        after, _ = assemble.assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(set(old), set(new))
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual({i for i in old if old[i] != new[i]}, set(POINTS))
        self.assertEqual({k:v for k,v in before.items() if k != 'places'},
                         {k:v for k,v in after.items() if k != 'places'})
        candidates = assemble.read_json(ROOT / (PREFIX + 'candidates.json'))['rows']
        updates = assemble.read_json(ROOT / (PREFIX + 'locations.json'))['updates']
        lifecycle = assemble.read_json(ROOT / (PREFIX + 'location-lifecycle.json'))
        prior = assemble.read_json(ROOT / (PREFIX + 'prior-values.json'))['rows']
        self.assertEqual({p['facilityId'] for p in updates}, set(POINTS))
        self.assertEqual({b['facilityId'] for b in lifecycle['bindings']}, set(POINTS))
        for fid, point in POINTS.items():
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual(new[fid]['coordinate'], point)
            self.assertEqual(new[fid]['locationReview']['status'], 'confirmed')
            c = next(c for c in candidates if c['facilityId'] == fid)
            self.assertEqual(c['oldRow'], old[fid])
            self.assertEqual(c['oldRowSHA256'], digest(old[fid]))
            u = next(u for u in updates if u['facilityId'] == fid)
            self.assertEqual(c['proposal'], u)  # approved evidence/coordinates unchanged
            b = next(b for b in lifecycle['bindings'] if b['facilityId'] == fid)
            self.assertEqual(b['adoption'], u)
            self.assertEqual(b['adoptionSHA256'], digest(u))
            self.assertEqual(b['identity'], {k: old[fid][k] for k in ('name', 'address')})
            p = next(p for p in prior if p['facilityId'] == fid)
            file, index = p['originalRef'].split('#/unresolved/')
            original = assemble.read_json(ROOT / file)['unresolved'][int(index)]
            self.assertEqual(p['originalRow'], original)
            self.assertEqual(p['originalRowSHA256'], digest(original))
        for fid in old:
            a, b = copy.deepcopy(old[fid]), copy.deepcopy(new[fid])
            if fid in POINTS:
                for key in ('coordinate', 'evidence', 'locationReview'):
                    a.pop(key, None); b.pop(key, None)
            self.assertEqual(a, b, fid)
        selected = {r['facilityId'] for r in assemble.read_json(ROOT / (PREFIX + 'selection.json'))['selected']}
        self.assertEqual(len(selected - POINTS.keys()), 3)
        for fid in selected - POINTS.keys():
            self.assertNotIn('coordinate', new[fid])
        self.assertEqual(len({tuple(p.values()) for p in POINTS.values()}), 4)
        self.assertEqual(len(lifecycle['groups']), 1)
        self.assertEqual(set(lifecycle['groups'][0]['facilityIds']), {
            'facility:kyushu-7a9f8dae19665147953f', 'facility:ws-61c944585418f01447'})
        self.assertEqual(sum('coordinate' not in p for p in old.values()) -
                         sum('coordinate' not in p for p in new.values()), 5)

if __name__ == '__main__':
    unittest.main()
