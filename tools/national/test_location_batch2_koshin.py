"""Exact regional delta, leaving historical contracts intact."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
import assemble as a

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/koshin/'
ADOPTED = {
    'facility:chubu-chuo-duty-counter',
    'facility:chubu-east-3c366372adb1d9e39b13',
    'facility:chubu-east-511d795c4d0bff516838',
    'facility:chubu-east-59b4cce2285148bd4dfd',
}


class KoshinBatch2Tests(unittest.TestCase):
    def test_exact_four_building_points_bindings_and_no_other_changes(self):
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        historical = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            historical[key] = [s for s in historical.get(key, []) if not s['path'].startswith(PREFIX)]
        before, _ = a.assemble(ROOT, historical)
        after, _ = a.assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(set(old), set(new))
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual({fid for fid in old if old[fid] != new[fid]}, ADOPTED)
        prior = a.read_json(ROOT / (PREFIX + 'prior-values.json'))['rows']
        for record in prior:
            self.assertEqual(old[record['facilityId']], record['old'])
            self.assertEqual(hashlib.sha256(json.dumps(record['old'], sort_keys=True, ensure_ascii=False).encode()).hexdigest(), record['oldSHA256'])
        rows = a.read_json(ROOT / (PREFIX + 'locations.json'))['updates']
        self.assertEqual({r['facilityId'] for r in rows}, ADOPTED)
        bindings = a.read_json(ROOT / (PREFIX + 'location-lifecycle.json'))['bindings']
        self.assertEqual({b['facilityId'] for b in bindings}, ADOPTED)
        for row in rows:
            fid = row['facilityId']
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual(new[fid]['coordinate'], row['coordinate'])
            self.assertEqual(new[fid]['locationReview']['status'], 'confirmed')
            restored = copy.deepcopy(new[fid])
            del restored['coordinate']
            del restored['locationReview']
            restored['evidence'] = old[fid]['evidence']
            self.assertEqual(restored, old[fid])
            binding = next(b for b in bindings if b['facilityId'] == fid)
            self.assertEqual(binding['identity'], {k: old[fid][k] for k in ('name', 'address')})
            self.assertEqual(binding['adoption'], row)
            self.assertEqual(binding['adoptionSHA256'], hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        selection = a.read_json(ROOT / (PREFIX + 'selection.json'))
        for r in selection['coverage']:
            if r['facilityId'] not in ADOPTED:
                self.assertNotIn('coordinate', new[r['facilityId']])
        # First-batch source rows and all original relation evidence remain untouched.
        for path, expected in selection['inputSHA256'].items():
            if path != 'tools/national/manifest.json':
                self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected)

    def test_suwa_identity_change_withholds_both_building_members(self):
        import location_lifecycle
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        ledger, _ = a.assemble(ROOT, manifest)
        doc = a.read_json(ROOT / (PREFIX + 'location-lifecycle.json'))
        rows = a.read_json(ROOT / (PREFIX + 'locations.json'))['updates']
        suwa = {'facility:chubu-east-3c366372adb1d9e39b13',
                'facility:chubu-east-511d795c4d0bff516838'}
        next(p for p in ledger['places'] if p['id'] == sorted(suwa)[0])['name'] += ' changed'
        after, _ = location_lifecycle.apply(ROOT, ledger, rows, [doc])
        for p in after['places']:
            if p['id'] in suwa:
                self.assertNotIn('coordinate', p)
                self.assertEqual(p['locationReview']['status'], 'needs-review')

    def test_evidence_links_reject_coordinate_and_reused_hash_mismatch(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('koshin_verify', ROOT / 'data/evidence/location-batch2/koshin/verify.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        updates = a.read_json(ROOT / (PREFIX + 'locations.json'))['updates']
        derived = a.read_json(ROOT / 'data/evidence/location-batch2/koshin/derived-points.json')['rows']
        comparison = a.read_json(ROOT / 'data/evidence/location-batch2/koshin/building-comparison.json')
        module.check_evidence_links(updates, derived, comparison)
        bad = copy.deepcopy(derived)
        next(r for r in bad if r['facilityId'] in ADOPTED)['coordinate']['lat'] += 1
        with self.assertRaises(AssertionError):
            module.check_evidence_links(updates, bad, comparison)
        bad = copy.deepcopy(comparison)
        bad['reusedSources'][0]['sources'][0]['snapshotSHA256'] = '0' * 64
        with self.assertRaises(AssertionError):
            module.check_evidence_links(updates, derived, bad)
