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
    def test_initial_numata_locator_matches_saved_source_fragment_indexes(self):
        geometry = a.read_json(ROOT / (EVIDENCE + 'numata-geometry.json'))
        updates = a.read_json(ROOT / (PREFIX + 'locations-proposed.json'))['updates']
        for row in updates:
            for fragment in geometry['sourceFragments']:
                self.assertIn('index' + str(fragment['sourceFeatureIndex']), row['evidence']['sourceLocator'])

    def test_round2_candidate_trial_preserves_unselected_places_and_relations(self):
        # Replay the research proposal against its pre-adoption baseline.
        manifest = a.read_json(ROOT / 'data/evidence/issue76/baseline-manifest.json')
        proposal = a.read_json(ROOT / (PREFIX + 'round2-manifest-proposal.json'))
        self.assertFalse(proposal['adoptionApproved'])
        self.assertFalse(proposal['manifestApplied'])
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
        report = a.read_json(ROOT / (PREFIX + 'round2-outcomes.json'))
        self.assertEqual(expected, {r['facilityId'] for r in report['facilities'] if r['candidateSelectedForReview']})
        self.assertEqual({fid for fid in old if old[fid] != new[fid]}, expected)
        for fid in expected:
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual({k for k in old[fid].keys() | new[fid].keys() if old[fid].get(k) != new[fid].get(k)}, {'coordinate', 'evidence', 'locationReview'})

    def test_all_assigned_facilities_have_investigation_evidence(self):
        assignments = a.read_json(ROOT / (PREFIX + 'assignments.json'))
        inventory = a.read_json(ROOT / (PREFIX + 'inventory.json'))
        expected = {row['facilityId'] for row in inventory['facilities']}
        assigned = [fid for group in assignments['groups'] for fid in group['facilityIds']]
        self.assertEqual(len(assigned), len(set(assigned)))
        self.assertEqual(set(assigned), expected)
        report = a.read_json(ROOT / (PREFIX + 'round2-outcomes.json'))
        self.assertEqual({row['facilityId'] for row in report['facilities']}, expected)
        self.assertEqual(len(report['facilities']), len(expected))
        self.assertFalse(report['adoptionApproved'])
        self.assertFalse(report['manifestApplied'])
        for group in assignments['groups']:
            child = a.read_json(ROOT / (group['nationalOutput'] + 'outcomes.json'))
            self.assertEqual({row['facilityId'] for row in child['facilities']}, set(group['facilityIds']))
            for row in child['facilities']:
                with self.subTest(facilityId=row['facilityId']):
                    self.assertTrue(row['performedMethods'])
                    self.assertTrue(row['sourceRefs'])
                    self.assertNotEqual(row['geometryStatus'], 'not_started')
                    self.assertTrue(row['nextAction'])
                    for ref in row['sourceRefs']:
                        self.assertTrue((ROOT / ref.split('#')[0]).is_file(), ref)
        for row in report['facilities']:
            source = ROOT / row['outcomePath']
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), row['outcomeSHA256'])
            child = a.read_json(source)
            found = [r for r in child['facilities'] if r['facilityId'] == row['facilityId']]
            self.assertEqual(len(found), 1)
            self.assertEqual(row['status'], found[0]['status'])

    def test_candidate_trial_changes_only_two_places_and_no_relations(self):
        # Replay the research proposal against its pre-adoption baseline.
        manifest = a.read_json(ROOT / 'data/evidence/issue76/baseline-manifest.json')
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
