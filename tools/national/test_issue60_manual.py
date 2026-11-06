"""Explicit three-point exception; no independent position approval is implied."""
import copy
import unittest
from unittest.mock import patch
from pathlib import Path
from assemble import assemble, apply_locations, read_json

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/issue60/manual-user-approval'
SOURCE = 'data/evidence/issue60/manual-user-approval'
POINTS = {
    'facility:kanto-south-f4a2060d8b43f0ac3acb': {'lat': 35.57720, 'lng': 140.38395},
    'facility:kanto-south-8d82eff13732778fad69': {'lat': 35.73177, 'lng': 139.22852},
    'facility:kanto-south-b8a0f5c7b930cf13dc47': {'lat': 35.25792, 'lng': 139.66228},
}
TOGANE = 'facility:kanto-south-f4a2060d8b43f0ac3acb'

class ManualApprovalTests(unittest.TestCase):
    def test_only_three_user_coordinates_change(self):
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        base = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            base[key] = [r for r in base[key] if not r['path'].startswith(PREFIX + '/')]
        before, _ = assemble(ROOT, base)
        after, _ = assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(POINTS.keys(), {fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual(1670, len(after['relations']))
        for fid, coordinate in POINTS.items():
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual(coordinate, new[fid]['coordinate'])
            self.assertEqual('利用者指定採用（位置・利用条件は未検証）', new[fid]['locationReview']['reason'])
            self.assertIn('Google', new[fid]['evidence']['verificationMethod'])
            self.assertEqual({k: v for k, v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},
                             {k: v for k, v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})

    def test_manual_gate_rejects_changed_old_value_id_point_and_claims(self):
        baseline, _ = assemble(ROOT, read_json(ROOT / SOURCE / 'baseline-manifest.json'))
        update = read_json(ROOT / PREFIX / 'locations.json')['updates'][0]
        for field, value in [('expectedOldPlaceSHA256', '0'*64), ('facilityId', TOGANE),
                             ('coordinate', {'lat': 35.73251, 'lng': 139.22867}),
                             ('positionValidation', 'independently-verified'),
                             ('usageTerms', 'verified'), ('approvalMode', 'independent-review')]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                apply_locations(baseline, [dict(update, **{field: value})], ROOT)
        bad = copy.deepcopy(update)
        bad['evidence']['snapshotSHA256'] = '0'*64
        with self.assertRaises(ValueError):
            apply_locations(baseline, [bad], ROOT)

    def test_revoked_togane_values_and_changed_input_are_rejected(self):
        baseline, _ = assemble(ROOT, read_json(ROOT / SOURCE / 'baseline-manifest.json'))
        rows = read_json(ROOT / PREFIX / 'locations.json')['updates']
        update = next(r for r in rows if r['facilityId'] == TOGANE)
        for co in ({'lat': 35.53986, 'lng': 140.34586}, {'lat': 35.57685, 'lng': 140.38330}):
            with self.subTest(co=co), self.assertRaises(ValueError):
                apply_locations(baseline, [dict(update, coordinate=co)], ROOT)
        decision = read_json(ROOT / SOURCE / 'decision.json')
        decision['inputSHA256'][SOURCE + '/user-messages.txt'] = '0' * 64
        with patch('manual_user_approval.read_json', return_value=decision):
            with self.assertRaisesRegex(ValueError, 'input hash mismatch'):
                apply_locations(baseline, [update], ROOT)
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        selected = next(s for s in manifest['locations'] if s['path'] == PREFIX + '/locations.json')
        selected['approved'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'approved location changed'):
            assemble(ROOT, manifest)

    def test_inputs_and_remaining_index(self):
        import hashlib
        from issue76_remaining import build
        saved = read_json(ROOT / SOURCE / 'preserved-inputs.json')
        for path, sha in saved.items():
            self.assertEqual(sha, hashlib.sha256((ROOT/path).read_bytes()).hexdigest(), path)
        index = build(ROOT)
        self.assertEqual((452,9,133,3), tuple(index['summary'][k] for k in ('remaining','kantoHeld','issue76Adopted','manualUserApproved')))
        self.assertNotIn(TOGANE, {r['facilityId'] for r in index['facilities']})
        self.assertEqual(index, read_json(ROOT / PREFIX / 'remaining-index.json'))

if __name__ == '__main__': unittest.main()
