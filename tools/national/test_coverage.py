"""Synthetic contract tests; no network or work-directory dependency."""
import copy
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest

from coverage import audit, region


def fixture():
    evidence = {'sourceUrl': 'https://example.gov/distribution', 'snapshotPath': 'saved.html',
                'snapshotSHA256': 'a' * 64, 'checkedAt': '2026-11-05'}
    places = []
    ledger_places = []
    for name, located in [('a', True), ('b', False), ('closed', True), ('candidate', False), ('proposal', False)]:
        pid = 'facility:' + name
        coord = {'status': 'confirmed' if located else 'unconfirmed'}
        lp = {'id': pid, 'legacyIds': [], 'evidence': evidence}
        if located:
            coord.update(lat=35, lng=139)
            lp['coordinate'] = {'lat': 35, 'lng': 139}
        if name == 'candidate':
            coord.update(status='candidate', lat=35, lng=139)
        places.append({'id': pid, 'name': name, 'coordinate': coord, 'evidence': evidence})
        ledger_places.append(lp)
    relations = []
    for cid, name, status, review in [('01-A', 'a', 'active', 'verified'),
                                      ('01-A', 'b', 'unknown', 'needs-review'),
                                      ('02-A', 'closed', 'ended', 'verified'),
                                      ('02-B', 'candidate', 'suspended', 'verified'),
                                      ('03-A', 'proposal', 'unknown', 'verified')]:
        relations.append({'cardId': cid, 'placeId': 'facility:' + name,
                          'status': status, 'review': review, 'evidence': evidence})
    ledger_relations = copy.deepcopy(relations)
    ledger_relations[-1]['change'] = {'kind': 'addition'}
    relations.append(copy.deepcopy(relations[0]))
    pins = [{'id': 'facility:a', 'kind': 'place', 'cardIds': ['01-A'], 'reference': False, 'lat': 35, 'lng': 139, 'status': 'active'},
            {'id': 'facility:closed', 'kind': 'place', 'cardIds': ['02-A'], 'reference': False, 'lat': 35, 'lng': 139, 'status': 'ended'},
            {'id': 'facility:candidate', 'kind': 'place', 'cardIds': ['02-B'], 'reference': True},
            {'id': 'lid:04-A', 'kind': 'lid', 'cardIds': ['04-A']}]
    full = {'schema': 1, 'evaluatedAt': '2026-11-05',
            'cards': [{'id': cid, 'status': 'active'} for cid in ['01-A', '02-A', '02-B', '03-A', '04-A']],
            'places': places, 'relations': relations, 'pins': pins}
    return full, {'schema': 1, 'places': ledger_places, 'relations': ledger_relations}


class CoverageTest(unittest.TestCase):
    def test_wrong_ledger_status_and_expiry_rejected(self):
        for patch in ({'status': 'ended'}, {'reviewUntil': '2000-01-01'},
                      {'validFrom': '2027-01-01'}, {'validTo': '2020-01-01'}):
            full, ledger = fixture()
            ledger['relations'][0].update(patch)
            with self.assertRaisesRegex(ValueError, 'ledger'):
                audit(full, ledger)

    def test_corrupt_pin_coordinate_and_status(self):
        for patch in ({'lat': 0}, {'lng': None}, {'lat': True}, {'status': 'ended'}):
            full, ledger = fixture()
            full['pins'][0].update(patch)
            with self.assertRaisesRegex(ValueError, 'pin'):
                audit(full, ledger)
        full, ledger = fixture()
        del full['pins'][0]['lat']
        with self.assertRaisesRegex(ValueError, 'pin'):
            audit(full, ledger)

    def test_issue5_assignment_boundaries(self):
        self.assertEqual(region("11-100-A001"), "kanto-north")
        self.assertEqual(region("12-100-A001"), "kanto-south")
        self.assertEqual(region("00-101-A001"), "kanto-south")

    def test_multiple_facilities_duplicates_and_states(self):
        result = audit(*fixture())
        s = result['summary']
        self.assertEqual((s['cards'], s['rawRelationRows'], s['uniqueCardPlacePairs'], s['duplicateRelationRows']), (5, 6, 5, 1))
        self.assertEqual(s['displayedPlaces'], 2)  # ended is still a pin
        self.assertEqual(s['activeLocatedCards'], 1)
        self.assertEqual(s['uniquePairStatuses'], dict(active=1, suspended=1, ended=1, unknown=2, upcoming=0))
        c = {r['cardId']: r for r in result['cards']}
        self.assertEqual(c['01-A']['displayCoverage'], 'partial')
        self.assertTrue(c['01-A']['hasUnknownDistribution'])
        self.assertFalse(c['04-A']['allRelationsVerified'])
        self.assertIn('no_relations', c['04-A']['reasons'])
        self.assertEqual(len(result['undisplayedCards']), 3)
        p = {r['placeId']: r for r in result['places']}
        self.assertEqual(p['facility:candidate']['gapClass'], 'location_only_unconfirmed')
        self.assertEqual(p['facility:proposal']['gapClass'], 'evidence_backed_distribution_unconfirmed')
        self.assertTrue(p['facility:proposal']['proposalAddition'])
        self.assertIn('facility:proposal', result['regions']['north']['unlocatedPlaceIds'])
        self.assertEqual(result['duplicateRelations'][0]['rawRows'], 2)

    def test_unknown_is_not_unreviewed(self):
        result = audit(*fixture())
        self.assertEqual(result['summary']['verifiedUniquePairs'], 4)
        self.assertEqual(result['summary']['knownStatusVerifiedUniquePairs'], 3)

    def test_located_unknown_is_displayed_but_not_active(self):
        full, ledger = fixture()
        for row in full['relations'] + ledger['relations']:
            if row['placeId'] == 'facility:a':
                row['status'] = 'unknown'
        full['pins'][0]['status'] = 'unknown'
        result = audit(full, ledger)
        self.assertEqual(result['summary']['displayedPlaces'], 2)
        self.assertEqual(result['summary']['activeLocatedCards'], 0)

    def test_stale_relation_evidence_does_not_verify_distribution(self):
        full, ledger = fixture()
        for row in full['relations']:
            if row['placeId'] == 'facility:a':
                row.update(review='needs-review', status='unknown')
        full['pins'] = [p for p in full['pins'] if p['id'] != 'facility:a']
        result = audit(full, ledger)
        p = next(p for p in result['undisplayedPlaces'] if p['placeId'] == 'facility:a')
        self.assertTrue(p['located'])
        self.assertEqual(p['gapClass'], 'evidence_backed_distribution_unconfirmed')

    def test_invalid_coordinate_types(self):
        for bad in (True, '35', None, float('nan'), 90):
            full, ledger = fixture()
            full['places'][0]['coordinate']['lat'] = bad
            with self.assertRaisesRegex(ValueError, 'coordinate'):
                audit(full, ledger)

    def test_unapproved_coordinates_and_dangling_ids_rejected(self):
        full, ledger = fixture()
        ledger['places'][0].pop('coordinate')
        with self.assertRaisesRegex(ValueError, 'coordinate'):
            audit(full, ledger)
        full, ledger = fixture()
        full['relations'][0]['placeId'] = 'absent'
        with self.assertRaisesRegex(ValueError, 'reference'):
            audit(full, ledger)

    def test_conflicting_duplicate_and_missing_pin_rejected(self):
        full, ledger = fixture()
        full['relations'][-1]['status'] = 'suspended'
        with self.assertRaisesRegex(ValueError, 'conflicting'):
            audit(full, ledger)
        full, ledger = fixture()
        full['pins'] = []
        with self.assertRaisesRegex(ValueError, 'pin'):
            audit(full, ledger)

    def test_proposal_must_be_present_in_generated_full(self):
        full, ledger = fixture()
        full['relations'] = [r for r in full['relations'] if r['placeId'] != 'facility:proposal']
        with self.assertRaisesRegex(ValueError, 'ledger relation'):
            audit(full, ledger)

    def test_shared_facility_regions_follow_card_prefix(self):
        full, ledger = fixture()
        r = dict(full['relations'][0], cardId='13-A')
        full['cards'].append({'id': '13-A'})
        full['relations'].append(r)
        ledger['relations'].append(r)
        full['pins'][0]['cardIds'].append('13-A')
        result = audit(full, ledger)
        self.assertEqual(result['regions']['kanto-south']['cardIds'], ['13-A'])
        self.assertEqual(result['summary']['displayedPlaces'], 2)

    def test_cli_reproducible_and_input_safe(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = [Path(tmp) / name for name in ('full.json', 'ledger.json')]
            for path, data in zip(paths, fixture()):
                path.write_text(json.dumps(data))
            cmd = [sys.executable, '-B', str(Path(__file__).with_name('coverage.py')), '--full', str(paths[0]), '--ledger', str(paths[1])]
            a = subprocess.run(cmd, capture_output=True, check=True)
            b = subprocess.run(cmd, capture_output=True, check=True)
            self.assertEqual(a.stdout, b.stdout)
            before = paths[0].read_bytes()
            bad = subprocess.run(cmd + ['--out', str(paths[0])], capture_output=True)
            self.assertNotEqual(bad.returncode, 0)
            self.assertEqual(paths[0].read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
