import copy
import json
from pathlib import Path
import unittest

import assemble

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/hokkaido/'
FID = 'facility:north-53b2b9df9a8da2705261'


class HokkaidoBatch2Tests(unittest.TestCase):
    def test_only_museum_location_and_binding_change(self):
        manifest = assemble.read_json(ROOT / 'tools/national/manifest.json')
        before_manifest = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            before_manifest[key] = [r for r in before_manifest[key]
                                    if not r['path'].startswith(PREFIX)]
        before, _ = assemble.assemble(ROOT, before_manifest)
        after, _ = assemble.assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(set(old), set(new))
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual({i for i in old if old[i] != new[i]}, {FID})
        self.assertNotIn('coordinate', old[FID])
        self.assertEqual(new[FID]['coordinate'], {'lat': 43.1170659, 'lng': 141.3425854})
        for i in old:
            a, b = copy.deepcopy(old[i]), copy.deepcopy(new[i])
            if i == FID:
                for k in ('coordinate', 'evidence', 'locationReview'):
                    a.pop(k, None)
                    b.pop(k, None)
            self.assertEqual(a, b)
        bindings = [b for s in manifest['locationLifecycle']
                    for b in assemble.read_json(ROOT / s['path'])['bindings']
                    if b['facilityId'] == FID]
        self.assertEqual(len(bindings), 1)
        self.assertEqual(bindings[0]['identity'], {k: new[FID][k] for k in ('name', 'address')})
        self.assertEqual(bindings[0]['adoption']['coordinate'], new[FID]['coordinate'])
        selected = assemble.read_json(ROOT / (PREFIX + 'selection.json'))['selectedIds']
        for i in selected:
            if i != FID:
                self.assertNotIn('coordinate', new[i])


if __name__ == '__main__':
    unittest.main()
