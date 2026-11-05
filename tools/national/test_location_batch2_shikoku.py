"""Exact Shikoku adoption delta, including all held facilities and old records."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
import assemble as a

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/shikoku/'
EXPECTED = {
    'facility:cs-1fe04097ed447030ce': {'lat': 34.1279514, 'lng': 134.6128622},
    'facility:cs-66c4c4fbd8f914efac': {'lat': 34.04372, 'lng': 132.9622799},
}

class ShikokuAdoptionTests(unittest.TestCase):
    def test_exact_delta_and_bindings(self):
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        historical = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            historical[key] = [r for r in historical.get(key, []) if not r['path'].startswith(PREFIX)]
        before, _ = a.assemble(ROOT, historical)
        after, _ = a.assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(set(old), set(new))
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual({i for i in old if old[i] != new[i]}, set(EXPECTED))
        bindings = [b for r in manifest.get('locationLifecycle', [])
                    if r['path'].startswith(PREFIX)
                    for b in a.read_json(ROOT / r['path'])['bindings']]
        self.assertEqual({b['facilityId'] for b in bindings}, set(EXPECTED))
        for fid, coordinate in EXPECTED.items():
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual(new[fid]['coordinate'], coordinate)
            self.assertEqual(new[fid]['locationReview']['status'], 'confirmed')
            restored = copy.deepcopy(new[fid])
            del restored['coordinate']
            del restored['locationReview']
            restored['evidence'] = old[fid]['evidence']
            self.assertEqual(restored, old[fid])
            binding = next(b for b in bindings if b['facilityId'] == fid)
            self.assertEqual(binding['identity'], {k: old[fid][k] for k in ('name', 'address')})
            self.assertEqual(binding['adoption']['coordinate'], coordinate)
            self.assertEqual(binding['adoptionSHA256'], hashlib.sha256(
                json.dumps(binding['adoption'], sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        selected = a.read_json(ROOT / (PREFIX + 'selection.json'))['selectedIds']
        for fid in set(selected) - set(EXPECTED):
            self.assertNotIn('coordinate', new[fid])

    def test_selected_original_rows_are_unchanged(self):
        baseline = a.read_json(ROOT / (PREFIX + 'before-rows.json'))
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        for key in ('locations', 'locationLifecycle'):
            manifest[key] = [r for r in manifest.get(key, []) if not r['path'].startswith(PREFIX)]
        ledger, _ = a.assemble(ROOT, manifest)
        places = {p['id']: p for p in ledger['places']}
        for row in baseline['rows']:
            self.assertEqual(places[row['id']], row)

if __name__ == '__main__':
    unittest.main()
