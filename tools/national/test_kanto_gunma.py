import copy
import hashlib
import json
from pathlib import Path
import unittest
import assemble as a
from research_common import rounded_coordinate

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/kanto-prefecture/gunma/'
EVIDENCE = 'data/evidence/kanto-prefecture/gunma/'


class GunmaResearchTest(unittest.TestCase):
    def test_candidate_trial_changes_only_two_places_and_no_relations(self):
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        proposal = a.read_json(ROOT / (PREFIX + 'manifest-proposal.json'))
        self.assertFalse(proposal['adoptionApproved'])
        self.assertFalse(any(PREFIX in r['path'] for k in ('locations', 'locationLifecycle') for r in manifest[k]))
        before, _ = a.assemble(ROOT, manifest)
        trial = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            trial[key].extend(proposal[key])
        after, _ = a.assemble(ROOT, trial)
        self.assertEqual(before['relations'], after['relations'])
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(old.keys(), new.keys())
        expected = set(proposal['candidateIds'])
        self.assertEqual({fid for fid in old if old[fid] != new[fid]}, expected)
        inventory = a.read_json(ROOT / (PREFIX + 'inventory.json'))
        for p in inventory['priorPlaces']:
            self.assertEqual(old[p['id']], p)
        for fid in expected:
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual({k for k in old[fid].keys() | new[fid].keys() if old[fid].get(k) != new[fid].get(k)}, {'coordinate', 'evidence', 'locationReview'})

    def test_rounded_point_and_raw_hashes(self):
        geometry = a.read_json(ROOT / (EVIDENCE + 'numata-geometry.json'))
        result = rounded_coordinate(geometry['unionGeometry'], geometry['baseTile'], geometry['centroidXY'])
        self.assertTrue(result['mechanicalChecksPassed'])
        self.assertEqual(result['coordinate'], geometry['coordinate'])
        for name in ('numata', 'yoshioka'):
            for tile in a.read_json(ROOT / (EVIDENCE + name + '-tiles.json'))['sources']:
                self.assertEqual(hashlib.sha256((ROOT / tile['path']).read_bytes()).hexdigest(), tile['sha256'])
        updates = a.read_json(ROOT / (PREFIX + 'locations-proposed.json'))['updates']
        self.assertEqual(len(updates), 2)
        for update in updates:
            self.assertEqual(update['coordinate'], result['coordinate'])


if __name__ == '__main__':
    unittest.main()
