import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import assemble as a


class AssemblyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'snapshot').write_bytes(b'evidence')
        self.ev = dict(sourceUrl='https://example.org/', snapshotPath='snapshot',
                       snapshotSHA256=hashlib.sha256(b'evidence').hexdigest(),
                       sourceLocator='facility', checkedAt='2026-11-05',
                       actorType='ai', verificationMethod='official marker')
        self.place = dict(id='p', legacyIds=['old'], name='P', evidence=self.ev)
        self.ledger = dict(schema=1, places=[self.place], relations=[dict(cardId='c', placeId='p', evidence=self.ev)])
        self.patch = dict(target='input', collection='places', match={'id': 'p'},
                          field='name', oldExists=True, old='P', new='New', evidence=self.ev)
        self.update = dict(facilityId='p', coordinate={'lat': 35.0, 'lng': 139.0}, evidence=self.ev)

    def test_exact_patch_and_input_unchanged(self):
        inputs = {'input': self.ledger}
        result = a.apply_patches(inputs, [self.patch], self.root)
        self.assertEqual(result['input']['places'][0]['name'], 'New')
        self.assertEqual(self.place['name'], 'P')

    def test_wrong_old_missing_target_and_duplicate_patch(self):
        for patches in [[dict(self.patch, old='wrong')], [dict(self.patch, match={'id': 'missing'})],
                        [self.patch, self.patch], [dict(self.patch, oldExists=False)]]:
            with self.subTest(patches=patches), self.assertRaises(ValueError):
                a.apply_patches({'input': self.ledger}, patches, self.root)

    def test_absent_field_precondition(self):
        patch = dict(self.patch, field='phone', oldExists=False, old=None, new='123')
        self.assertEqual(a.apply_patches({'input': self.ledger}, [patch], self.root)['input']['places'][0]['phone'], '123')

    def test_merge_exact_only_and_references(self):
        self.assertEqual(a.merge([self.ledger, self.ledger]), self.ledger)
        other = copy.deepcopy(self.ledger)
        other['places'][0]['name'] = 'conflict'
        with self.assertRaises(ValueError):
            a.merge([self.ledger, other])
        other = copy.deepcopy(self.ledger)
        other['relations'][0]['placeId'] = 'missing'
        with self.assertRaises(ValueError):
            a.merge([other])
        other = copy.deepcopy(self.ledger)
        other['places'][0]['id'] = 'another'
        with self.assertRaises(ValueError):
            a.merge([self.ledger, other])
        other = copy.deepcopy(self.ledger)
        other['relations'][0]['status'] = 'ended'
        with self.assertRaises(ValueError):
            a.merge([self.ledger, other])

    def test_locations_after_merge_and_no_overwrite(self):
        out, audit = a.apply_locations(self.ledger, [self.update], self.root)
        self.assertEqual(out['places'][0]['coordinate'], self.update['coordinate'])
        self.assertNotIn('coordinate', self.place)
        for ledger, updates in [(out, [self.update]), (self.ledger, [self.update, self.update]),
                                (self.ledger, [dict(self.update, facilityId='missing')])]:
            with self.assertRaises(ValueError):
                a.apply_locations(ledger, updates, self.root)

    def test_coordinate_types(self):
        for coord in [{'lat': '35', 'lng': 139}, {'lat': True, 'lng': 139}, {'lat': 35},
                      {'lat': None, 'lng': 139}, {'lat': 91, 'lng': 139},
                      {'lat': float('nan'), 'lng': 139}, {'lat': 35, 'lng': 181}]:
            with self.subTest(coord=coord), self.assertRaises(ValueError):
                a.apply_locations(self.ledger, [dict(self.update, coordinate=coord)], self.root)

    def test_timestamp_and_hash(self):
        ev = dict(self.ev, checkedAt='2026-11-05T04:55:42.409507+00:00')
        out, audit = a.apply_locations(self.ledger, [dict(self.update, evidence=ev)], self.root)
        self.assertEqual(out['places'][0]['evidence']['checkedAt'], '2026-11-05')
        self.assertEqual(audit[0]['originalEvidence'], ev)
        for bad in [dict(ev, snapshotSHA256='0'*64), dict(ev, checkedAt='2026-99-99'),
                    dict(ev, checkedAt='2026-11-05T12:00:00')]:
            with self.assertRaises(ValueError):
                a.apply_locations(self.ledger, [dict(self.update, evidence=bad)], self.root)

    def test_review_selection_excludes_deferred_and_facility_scope(self):
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        inputs, patches, updates = a.load_selection(root, manifest)
        self.assertEqual(len(patches), 111)
        self.assertEqual(len(updates), 840)
        self.assertTrue(all(p['target'] in inputs for p in patches))
        self.assertTrue(all(p['new'] is not None for p in patches))
        chiba = a.read_json(root / 'data/national/location-updates/kanto-south-chiba.json')
        ids = {u['facilityId'] for u in updates}
        review = a.read_json(root / 'data/national/reviews/facility-point-scope.json')
        approved = set(review['acceptedFacilityIds'])
        self.assertTrue(all((u['facilityId'] in ids) == (u['facilityId'] in approved) for u in chiba['updates'] if u['scope'] == 'facility'))

    def test_issue7_rejected_buildings_are_not_selected(self):
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        _, _, updates = a.load_selection(root, manifest)
        ids = {u['facilityId'] for u in updates}
        # Oyama's old/new city hall and Yoshioka's community center remain unresolved.
        for fid in ('facility:kanto-north-8c9c3d00b39e57cb61d7',
                    'facility:kanto-north-c0a593ee1ebbefef4ded',
                    'facility:kanto-north-caa883741cf60ee761be'):
            self.assertNotIn(fid, ids)
        self.assertIn('facility:kanto-south-7d5b518b29440ef8d976', ids)

    def test_full_offline_assembly_matches_reviewed_baseline(self):
        # Digest was compared against the parent's manual output once. CI never
        # opens that work file and needs no full.json/cards.json/raw inputs.
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        paths = manifest['inputs'] + [p['path'] for p in manifest['patches'] + manifest['locations']]
        before = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in paths}
        output, audit = a.assemble(root, manifest)
        digest = hashlib.sha256(json.dumps(output, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(digest, 'd89e788b0998fd625ea3d2b06e4cae6ff85c1c30f1526bc18c6bd8908702a5ff')
        self.assertEqual((len(output['places']), len(output['relations'])), (1586, 1670))
        self.assertEqual((audit['patchesApplied'], audit['locationsApplied']), (111, 840))
        self.assertEqual(before, {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in paths})

    def test_whole_row_exact_and_overlapping_patches(self):
        replacement = dict(self.place, name='Replacement')
        patch = dict(target='input', collection='places', match={'id': 'p'},
                     old=copy.deepcopy(self.place), new=replacement, evidence=self.ev)
        result = a.apply_patches({'input': self.ledger}, [patch], self.root)
        self.assertEqual(result['input']['places'][0], replacement)
        for patches in [[dict(patch, old=dict(self.place, name='wrong'))],
                        [patch, self.patch], [self.patch, patch], [dict(patch, new=None)]]:
            with self.assertRaises(ValueError):
                a.apply_patches({'input': self.ledger}, patches, self.root)

    def test_manifest_selection_cannot_expand_silently(self):
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        manifest['patches'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'patch manifest hash mismatch'):
            a.load_selection(root, manifest)
        manifest = a.read_json(root / 'tools/national/manifest.json')
        manifest['locations'][0]['approved'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'approved location changed'):
            a.load_selection(root, manifest)

    def test_json_duplicates_and_nonfinite_numbers_fail(self):
        path = self.root / 'bad.json'
        for raw in ['{"a": 1, "a": 1}', '{"lat": NaN}', '{"lat": Infinity}']:
            path.write_text(raw)
            with self.assertRaises(ValueError):
                a.read_json(path)


if __name__ == '__main__':
    unittest.main()
