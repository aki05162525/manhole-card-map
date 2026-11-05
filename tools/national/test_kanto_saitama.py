"""Draft candidates: validate isolation and full-ledger effects without adoption."""
import copy
import hashlib
import json
from pathlib import Path
import unittest

from assemble import assemble, read_json
from location_lifecycle import digest
from research_common import rounded_coordinate

ROOT = Path(__file__).resolve().parents[2]
N = 'data/national/kanto-prefecture/saitama/'
E = 'data/evidence/kanto-prefecture/saitama/'


class SaitamaDraftTests(unittest.TestCase):
    def test_inventory_and_historical_inputs(self):
        inventory = read_json(ROOT / (N + 'inventory.json'))
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        ledger, _ = assemble(ROOT, manifest)
        places = {p['id']: p for p in ledger['places']}
        self.assertEqual(39, len(inventory['rows']))
        self.assertEqual(39, len({r['facilityId'] for r in inventory['rows']}))
        for path, expected in inventory['inputSHA256'].items():
            self.assertEqual(expected, hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), path)
        for row in inventory['rows']:
            self.assertEqual(row['oldPlace'], places[row['facilityId']])
            self.assertEqual(row['oldRelations'], [r for r in ledger['relations'] if r['placeId'] == row['facilityId']])
        self.assertFalse(any('/kanto-prefecture/saitama/' in str(s) for s in manifest['locations']))

    def test_candidate_geometry_and_binding(self):
        document = read_json(ROOT / (N + 'locations.json'))
        bindings = read_json(ROOT / (N + 'location-lifecycle.json'))['bindings']
        geometry = read_json(ROOT / (E + 'kounosu-geometry.json'))
        derived = rounded_coordinate(geometry['geometry'], geometry['tile'], geometry['pointXY'])
        self.assertTrue(derived['mechanicalChecksPassed'])
        self.assertEqual(2, len(document['updates']))
        for update, binding in zip(document['updates'], bindings):
            self.assertEqual(derived['coordinate'], update['coordinate'])
            self.assertEqual(update, binding['adoption'])
            self.assertEqual(digest(update), binding['adoptionSHA256'])

    def test_hypothetical_selection_changes_only_two_locations(self):
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        before, _ = assemble(ROOT, manifest)
        proposed = read_json(ROOT / (N + 'selection-proposal.json'))
        self.assertFalse(proposed['adoptionApproved'])
        trial = copy.deepcopy(manifest)
        trial['locations'].append(proposed['locations'])
        trial['locationLifecycle'].append(proposed['locationLifecycle'])
        after, _ = assemble(ROOT, trial)
        self.assertEqual(before['relations'], after['relations'])
        expected = {x['facilityId'] for x in proposed['locations']['approved']}
        changed = set()
        for old, new in zip(before['places'], after['places']):
            self.assertEqual(old['id'], new['id'])
            if old != new:
                changed.add(old['id'])
                stripped = {k: v for k, v in new.items() if k not in ('coordinate', 'locationReview', 'evidence')}
                self.assertEqual({k: v for k, v in old.items() if k != 'evidence'}, stripped)
        self.assertEqual(expected, changed)


class SaitamaFullInvestigationTests(unittest.TestCase):
    def test_full_proposal_has_only_bound_location_changes(self):
        proposal = read_json(ROOT / (N + 'full-selection-proposal.json'))
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        before, _ = assemble(ROOT, manifest)
        trial = copy.deepcopy(manifest)
        trial['locations'].append(proposal['locations'])
        trial['locationLifecycle'].append(proposal['locationLifecycle'])
        after, _ = assemble(ROOT, trial)
        self.assertFalse(proposal['adoptionApproved'])
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual([p['id'] for p in before['places']], [p['id'] for p in after['places']])
        changed = set()
        for old, new in zip(before['places'], after['places']):
            if old != new:
                changed.add(old['id'])
                self.assertEqual(
                    {k: v for k, v in old.items() if k not in ('coordinate', 'locationReview', 'evidence')},
                    {k: v for k, v in new.items() if k not in ('coordinate', 'locationReview', 'evidence')})
        self.assertEqual({r['facilityId'] for r in proposal['locations']['approved']}, changed)

    def test_every_assigned_facility_has_actual_work_and_traceable_result(self):
        assignment = read_json(ROOT / (N + 'parallel-assignment.json'))
        document = read_json(ROOT / (N + 'full-outcomes.json'))
        assigned = [f['facilityId'] for g in assignment['groups'] for f in g['facilities']]
        rows = document['rows']
        self.assertEqual(39, len(assigned))
        self.assertEqual(39, len(set(assigned)))
        self.assertEqual(set(assigned), {r['facilityId'] for r in rows})
        self.assertEqual(39, len(rows))
        self.assertFalse(document['adoptionApproved'])
        self.assertFalse(document['manifestModified'])
        for row in rows:
            self.assertTrue(row['performedMethods'], row['facilityId'])
            self.assertNotIn(row['status'], ('not-started', 'queued', 'planned'))
            self.assertTrue(row['evidenceReferences'], row['facilityId'])
            for ref in row['evidenceReferences']:
                self.assertEqual(ref['sha256'], hashlib.sha256((ROOT / ref['path']).read_bytes()).hexdigest())
            self.assertTrue(row['remainingWork'] or row['candidateCoordinate'])
            if row['candidateCoordinate']:
                self.assertTrue(row['buildingComparisonPerformed'], row['facilityId'])
                self.assertFalse(row['adoptionApproved'])


if __name__ == '__main__':
    unittest.main()
