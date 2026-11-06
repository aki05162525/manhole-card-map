import copy
import hashlib
import json
from pathlib import Path
import unittest
import assemble as a

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/north-kanto/'
EXPECTED = {
    'facility:kanto-north-2e945c5e9faf1a16c8d7': {'lat': 36.5991526, 'lng': 140.6503817},
    'facility:kanto-north-c73669beeeb24f667599': {'lat': 36.1716201, 'lng': 139.6014386},
}

class NorthKantoBatch2Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        cls.after, _ = a.assemble(ROOT, cls.manifest)
        historical = copy.deepcopy(cls.manifest)
        for key in ('locations', 'locationLifecycle'):
            historical[key] = [p for p in historical[key] if not p['path'].startswith(PREFIX)]
        cls.before, _ = a.assemble(ROOT, historical)

    def test_two_buildings_have_derived_points_and_bindings(self):
        places = {p['id']: p for p in self.after['places']}
        for fid, coordinate in EXPECTED.items():
            with self.subTest(facilityId=fid):
                self.assertEqual(places[fid].get('coordinate'), coordinate)
                bindings = [b for s in self.manifest['locationLifecycle']
                            for b in a.read_json(ROOT / s['path'])['bindings'] if b['facilityId'] == fid]
                self.assertEqual(len(bindings), 1)
                b = bindings[0]
                self.assertEqual(b['identity'], {k: places[fid][k] for k in ('name', 'address')})
                self.assertEqual(b['adoptionSHA256'], hashlib.sha256(json.dumps(b['adoption'], sort_keys=True, ensure_ascii=False).encode()).hexdigest())
                self.assertEqual(b['adoption']['coordinate'], coordinate)

    def test_exact_delta_preserves_other_places(self):
        before = {p['id']: p for p in self.before['places']}
        after = {p['id']: p for p in self.after['places']}
        self.assertEqual(self.before['relations'], self.after['relations'])
        self.assertEqual(before.keys(), after.keys())
        self.assertEqual({fid for fid in before if before[fid] != after[fid]}, set(EXPECTED))
        for fid in before:
            if fid not in EXPECTED:
                self.assertEqual(before[fid], after[fid])
                continue
            self.assertNotIn('coordinate', before[fid])
            changed = {k for k in before[fid].keys() | after[fid].keys() if before[fid].get(k) != after[fid].get(k)}
            self.assertEqual(changed, {'coordinate', 'evidence', 'locationReview'})

    def test_six_nonadoptions_at_research_baseline(self):
        # Subsequent Issue76 approvals do not rewrite this historical decision.
        ledger, _ = a.assemble(ROOT, a.read_json(ROOT / 'data/evidence/issue76/baseline-manifest.json'))
        after = {p['id']: p for p in ledger['places']}
        selected = a.read_json(ROOT / (PREFIX + 'selection.json'))['selected']
        for row in selected:
            if row['facilityId'] not in EXPECTED:
                self.assertNotIn('coordinate', after[row['facilityId']])

if __name__ == '__main__':
    unittest.main()
