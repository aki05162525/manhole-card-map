import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import assemble as a


def batch1_manifest(root):
    # Later regional research must not rewrite the historical Batch1 contract.
    manifest = a.read_json(root / 'tools/national/manifest.json')
    for key in ('locations', 'locationLifecycle'):
        manifest[key] = [row for row in manifest.get(key, [])
                         if not row['path'].startswith('data/national/location-batch2/')]
    return manifest


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

    def test_geographic_boundaries_match_go_contract_without_clamping(self):
        for magnitude in (85, 85.01, 85.051129, 86, 90, 90.01):
            for sign in (-1, 1):
                value = {'lat': sign * magnitude, 'lng': 180}
                with self.subTest(coordinate=value):
                    if magnitude > 90:
                        with self.assertRaises(ValueError):
                            a.coordinate(value)
                    else:
                        original = dict(value)
                        a.coordinate(value)
                        self.assertEqual(value, original)
        for longitude in (-180, 180):
            a.coordinate({'lat': 90, 'lng': longitude})
        for longitude in (-180.01, 180.01):
            with self.assertRaises(ValueError):
                a.coordinate({'lat': 0, 'lng': longitude})
        for bad in (False, '35', None, float('nan'), float('inf'), -float('inf')):
            for axis in ('lat', 'lng'):
                value = {'lat': 35, 'lng': 139}
                value[axis] = bad
                with self.subTest(coordinate=value), self.assertRaises(ValueError):
                    a.coordinate(value)

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
        manifest = batch1_manifest(root)
        inputs, patches, updates = a.load_selection(root, manifest)
        self.assertEqual(len(patches), 113)  # Issue26 adds only address and evidence fields.
        self.assertEqual(len(updates), 844)  # Batch1: four independently reviewed facilities.
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
        manifest = batch1_manifest(root)
        # Keep the reviewed pre-Issue26 baseline intact. The next test proves
        # the exact address/evidence-only delta of the newly selected patch.
        manifest['patches'] = [p for p in manifest['patches']
                               if p['path'] != 'data/national/issue26/address-patch.json']
        # Batch1 has its own full-ledger delta check below; preserve the
        # historical digest instead of replacing it with a new output hash.
        manifest['locations'] = [p for p in manifest['locations']
                                 if p['path'] != 'data/national/location-batch1/locations-reviewed.json']
        manifest['locationLifecycle'] = [p for p in manifest.get('locationLifecycle', [])
                                         if p['path'] != 'data/national/location-batch1/location-lifecycle.json']
        paths = manifest['inputs'] + [p['path'] for p in manifest['patches'] + manifest['locations']]
        before = {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in paths}
        output, audit = a.assemble(root, manifest)
        digest = hashlib.sha256(json.dumps(output, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        self.assertEqual(digest, 'd89e788b0998fd625ea3d2b06e4cae6ff85c1c30f1526bc18c6bd8908702a5ff')
        self.assertEqual((len(output['places']), len(output['relations'])), (1586, 1670))
        self.assertEqual((audit['patchesApplied'], audit['locationsApplied']), (111, 840))
        self.assertEqual(before, {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in paths})

    def test_ishinomaki_address_renumbering_preserves_floor_and_other_records(self):
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        output, _ = a.assemble(root, manifest)
        fid = 'facility:north-3443a4a6d08de5680f46'
        actual = next(p for p in output['places'] if p['id'] == fid)
        self.assertEqual(actual['address'], '宮城県石巻市中央二丁目11番12号 1階')
        self.assertNotIn('coordinate', actual)
        selection = 'data/national/issue26/address-patch.json'
        historical = copy.deepcopy(manifest)
        historical['patches'] = [p for p in historical['patches'] if p['path'] != selection]
        before, _ = a.assemble(root, historical)
        expected = copy.deepcopy(before)
        old = next(p for p in expected['places'] if p['id'] == fid)
        self.assertEqual(old['address'], '宮城県石巻市中央二丁目11番21 1階')
        patch = a.read_json(root / selection)['patches']
        self.assertEqual([p['field'] for p in patch], ['address', 'evidence'])
        for change in patch:
            self.assertEqual(change['match'], {'id': fid})
            self.assertEqual(old[change['field']], change['old'])
            old[change['field']] = change['new']
        self.assertEqual(output, expected)
        self.assertEqual(output['relations'], before['relations'])

    def test_batch1_osaka_museum_has_reviewed_building_point_and_binding(self):
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        output, audit = a.assemble(root, manifest)
        fid = 'facility:kinki-5541e22064b914088d81'
        place = next(p for p in output['places'] if p['id'] == fid)
        # Osaka's own cultural-facility CSV, not the nearby treatment plant
        # or a map viewport. These are the source JGD2011 decimal values.
        self.assertEqual(place.get('coordinate'),
                         {'lat': 34.693530220001, 'lng': 135.462397900002})
        self.assertIn('locationLifecycle', audit)
        bindings = [b for s in manifest['locationLifecycle']
                    for b in a.read_json(root / s['path'])['bindings']]
        binding = next(b for b in bindings if b['facilityId'] == fid)
        self.assertEqual(binding['identity'],
                         {'name': place['name'], 'address': place['address']})
        self.assertEqual(binding['adoption']['coordinate'], place['coordinate'])

    def test_batch1_only_changes_reviewed_facilities_and_preserves_relations(self):
        root = Path(__file__).resolve().parents[2]
        manifest = batch1_manifest(root)
        historical = copy.deepcopy(manifest)
        historical['locations'] = [p for p in historical['locations']
                                  if p['path'] != 'data/national/location-batch1/locations-reviewed.json']
        historical['locationLifecycle'] = [p for p in historical.get('locationLifecycle', [])
                                          if p['path'] != 'data/national/location-batch1/location-lifecycle.json']
        before, _ = a.assemble(root, historical)
        after, _ = a.assemble(root, manifest)
        old_by_id = {p['id']: p for p in before['places']}
        new_by_id = {p['id']: p for p in after['places']}
        self.assertEqual(set(old_by_id), set(new_by_id))
        self.assertEqual(before['relations'], after['relations'])
        adopted = a.read_json(root / 'data/national/location-batch1/locations-reviewed.json')['updates']
        self.assertEqual(len(adopted), 4)
        adopted_ids = {row['facilityId'] for row in adopted}
        self.assertEqual(adopted_ids, {
            'facility:kinki-5541e22064b914088d81',  # Osaka sewage museum
            'facility:kinki-daaa4e44e2c541067679',  # Swan Hall
            'facility:cs-56534586c259fb790a',  # Horseshoe crab museum
            'facility:kyushu-9c9600ef3b6f5d63e1f1',  # Oita city art museum
        })
        # Reproducible geometry alone does not establish the receiving
        # facility's building. The independent review withheld these two.
        for fid in ('facility:chubu-west-305c4ff7d31e4b18d58b',
                    'facility:chubu-west-1b6382f20cc3aec78ecd'):
            self.assertNotIn(fid, adopted_ids)
            self.assertNotIn('coordinate', new_by_id[fid])
        self.assertEqual({fid for fid in old_by_id if old_by_id[fid] != new_by_id[fid]}, adopted_ids)
        for row in adopted:
            fid = row['facilityId']
            old, new = old_by_id[fid], new_by_id[fid]
            self.assertNotIn('coordinate', old)
            self.assertEqual(new['coordinate'], row['coordinate'])
            self.assertEqual(new['locationReview']['status'], 'confirmed')
            self.assertEqual(new['locationReview']['addressStatus'], 'valid')
            # No identity, hours, phone or other fields may change during
            # location adoption. Evidence is replaced, not silently edited.
            restored = copy.deepcopy(new)
            del restored['coordinate']
            del restored['locationReview']
            restored['evidence'] = old['evidence']
            self.assertEqual(restored, old)

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
