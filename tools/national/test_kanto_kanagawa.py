"""Offline checks for the unapproved Kanagawa research handoff."""
import copy
import hashlib
import json
from pathlib import Path
import unittest

from assemble import assemble, read_json
from research_common import rounded_coordinate

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/national/kanto-prefecture/kanagawa'
EVIDENCE = ROOT / 'data/evidence/kanto-prefecture/kanagawa'
FID = 'facility:kanto-south-d3e8ff1b9fe8cdfa07d3'


class KanagawaHandoffTests(unittest.TestCase):
    def test_scope_and_inherited_evidence(self):
        scope = read_json(DATA / 'scope.json')
        self.assertEqual(len(scope['facilities']), 14)
        self.assertEqual(len({r['currentPlace']['id'] for r in scope['facilities']}), 14)
        for row in scope['facilities']:
            self.assertNotIn('coordinate', row['currentPlace'])
            self.assertFalse(row['inheritedIndex']['adoptionApproval'])
            ev = row['currentPlace']['evidence']
            self.assertEqual(hashlib.sha256((ROOT / ev['snapshotPath']).read_bytes()).hexdigest(), ev['snapshotSHA256'])

    def test_candidate_is_interior_but_not_approved(self):
        record = read_json(EVIDENCE / 'sagamihara-numeric.json')
        result = rounded_coordinate(record['features'][0]['geometry'], record['baseTile'], record['pointXY'])
        self.assertTrue(result['mechanicalChecksPassed'])
        self.assertEqual(result['coordinate'], record['coordinate'])
        self.assertFalse(record['adoptionApproved'])
        self.assertFalse(rounded_coordinate(record['features'][0]['geometry'], record['baseTile'], [0, 0])['mechanicalChecksPassed'])

    def test_proposal_changes_only_one_place_and_rejects_hash_tampering(self):
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        # Parent integration may later select these proposals. Build the same
        # comparison baseline without removing any other region's selections.
        for key in ('locations', 'locationLifecycle'):
            manifest[key] = [s for s in manifest.get(key, []) if not s['path'].startswith('data/national/kanto-prefecture/kanagawa/')]
        before, _ = assemble(ROOT, manifest)
        proposal = read_json(DATA / 'selection-proposed.json')
        self.assertFalse(proposal['approvedForIntegration'])
        selected = copy.deepcopy(manifest)
        selected['locations'].append(proposal['locations'])
        selected.setdefault('locationLifecycle', []).append(proposal['locationLifecycle'])
        after, _ = assemble(ROOT, selected)
        self.assertEqual(before['relations'], after['relations'])
        changes = [(a, b) for a, b in zip(before['places'], after['places']) if a != b]
        self.assertEqual([a['id'] for a, _ in changes], [FID])
        old, new = changes[0]
        self.assertEqual(old, {**{k: v for k, v in new.items() if k not in ('coordinate', 'locationReview')}, 'evidence': old['evidence']})
        selected['locations'][-1]['approved'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'approved location changed'):
            assemble(ROOT, selected)


if __name__ == '__main__':
    unittest.main()
