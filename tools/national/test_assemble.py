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

    def test_current_selection_preserves_identity_relations_and_adopts_only_selected(self):
        root = Path(__file__).resolve().parents[2]
        manifest = a.read_json(root / 'tools/national/manifest.json')
        inputs, patches, updates = a.load_selection(root, manifest)
        baseline = a.merge(list(a.apply_patches(inputs, patches, root).values()))
        before = copy.deepcopy(baseline)
        output, _ = a.assemble(root, manifest)
        self.assertEqual(baseline, before)
        self.assertEqual(output['relations'], baseline['relations'])
        old = {p['id']: p for p in baseline['places']}
        new = {p['id']: p for p in output['places']}
        self.assertEqual(old.keys(), new.keys())
        selected = {u['facilityId'] for u in updates}
        for fid, place in new.items():
            self.assertEqual(place['name'], old[fid]['name'])
            self.assertEqual(place['address'], old[fid]['address'])
            if fid not in selected:
                self.assertEqual(place, old[fid])
        self.assertEqual({fid for fid in new if new[fid] != old[fid]}, selected)

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
