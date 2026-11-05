"""Exact delta contract for the two Kinki-west building proposals."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
import assemble as a

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/kinki-west/'
POINTS = {
    'facility:kinki-0df3699f1debe84ccd2a': {'lat': 34.748402, 'lng': 134.9130319},
    'facility:kinki-1ca68b2dbec83466c8f0': {'lat': 34.5775854, 'lng': 135.6296097},
}


class KinkiWestBatch2Tests(unittest.TestCase):
    def test_exact_building_delta_with_bound_source_and_six_holds(self):
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        before_manifest = copy.deepcopy(manifest)
        for key in ['locations', 'locationLifecycle']:
            before_manifest[key] = [s for s in before_manifest[key] if not s['path'].startswith(PREFIX)]
        before, _ = a.assemble(ROOT, before_manifest)
        after, _ = a.assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(before['relations'], after['relations'])
        for fid, coordinate in POINTS.items():
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual(new[fid].get('coordinate'), coordinate)
        bindings = a.read_json(ROOT / (PREFIX+'location-lifecycle.json'))['bindings']
        self.assertEqual({b['facilityId'] for b in bindings}, set(POINTS))
        proposals = a.read_json(ROOT / (PREFIX+'locations.json'))['updates']
        for b in bindings:
            fid = b['facilityId']
            self.assertEqual(b['identity'], {k: old[fid][k] for k in ['name', 'address']})
            self.assertEqual(b['adoption'], next(r for r in proposals if r['facilityId'] == fid))
            self.assertEqual(b['adoptionSHA256'], hashlib.sha256(json.dumps(b['adoption'], sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        facts = a.read_json(ROOT / 'data/evidence/location-batch2/kinki-west/building-correspondence.json')
        for row in facts['rows']:
            self.assertEqual(row['previousPlaceSHA256'], hashlib.sha256(json.dumps(old[row['facilityId']], sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        for fid in old:
            if fid in POINTS:
                stripped = {k: v for k, v in new[fid].items() if k not in ['coordinate','evidence','locationReview']}
                expected = {k: v for k, v in old[fid].items() if k != 'evidence'}
                self.assertEqual(stripped, expected)
                self.assertEqual(new[fid]['locationReview']['status'], 'confirmed')
            else:
                self.assertEqual(new[fid], old[fid])
        selected = a.read_json(ROOT / (PREFIX+'selection.json'))['rows']
        held = {r['facilityId'] for r in selected} - POINTS.keys()
        self.assertEqual(len(held), 6)
        for fid in held:
            self.assertNotIn('coordinate', new[fid])
