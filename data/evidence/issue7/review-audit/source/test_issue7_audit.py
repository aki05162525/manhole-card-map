import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import issue7_audit as audit


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.assignments = {r: [] for r in audit.REGIONS}
        for n in range(810):
            self.assignments[audit.REGIONS[n % 13]].append(f'facility:{n}')
        self.write('baseline.json', dict(schema=1, assignments=self.assignments,
                   baselineLocationIds=[f'facility:old{n}' for n in range(642)]))
        for r, ids in self.assignments.items():
            self.write(f'regions/{r}.json', dict(schema=1, updates=[], unresolved=[
                dict(facilityId=i, reasonCategory='source', reason='not found',
                     nextSource={'required': 'GIS'}, attempts=[], investigationStatus='partial') for i in ids]))
        self.row = dict(facilityId='facility:0', coordinate=dict(lat=35, lng=139))
        self.write('followup.json', dict(schema=1, updates=[self.row]))
        self.manifest = dict(schema=1, locations=[dict(path='followup.json', approved=[dict(
            facilityId='facility:0', sha256=self.digest(self.row))])])
        self.write('manifest.json', self.manifest)

    def digest(self, row):
        return hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    def write(self, name, data):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data))

    def run_audit(self, **kwargs):
        return audit.audit(self.root, 'baseline.json', 'manifest.json', 'regions', **kwargs)

    def change_region(self, fn):
        p = self.root / 'regions/hokkaido.json'
        d = json.loads(p.read_text())
        fn(d)
        self.write('regions/hokkaido.json', d)

    def test_followup_keeps_original_and_unknown_generation(self):
        result = self.run_audit()
        self.assertEqual(result['summary']['originalUnresolved'], 810)
        self.assertEqual(result['summary']['currentAdopted'], 1)
        self.assertEqual(result['summary']['currentRemaining'], 809)
        self.assertIsNone(result['summary']['adoptedLocationNotGenerated'])
        row = next(r for r in result['facilities'] if r['facilityId'] == 'facility:0')
        self.assertEqual(row['originalClassification'], 'unresolved')
        self.assertEqual(row['original']['attempts'], [])
        self.assertEqual(row['currentSelection']['path'], 'followup.json')
        self.assertIn('manifest.json', result['inputSHA256'])
        self.assertEqual(result, self.run_audit())

    def test_reject_missing_duplicate_outside_and_unclassified(self):
        for mutate in [lambda d: d['unresolved'].pop(),
                       lambda d: d['unresolved'].append(d['unresolved'][0]),
                       lambda d: d['unresolved'][0].update(facilityId='facility:1'),
                       lambda d: d['unresolved'][0].pop('reasonCategory'),
                       lambda d: d['unresolved'][0].update(attempts='done')]:
            with self.subTest(mutate=mutate):
                p = self.root / 'regions/hokkaido.json'
                original = p.read_bytes()
                self.change_region(mutate)
                with self.assertRaises(ValueError):
                    self.run_audit()
                p.write_bytes(original)

    def test_reject_invalid_candidate(self):
        def mutate(d):
            r = d['unresolved'].pop(0)
            d['updates'].append(dict(facilityId=r['facilityId'], coordinate=dict(lat=True, lng=139)))
        self.change_region(mutate)
        with self.assertRaises(ValueError):
            self.run_audit()

    def test_reject_changed_approval_and_duplicate_selection(self):
        self.write('followup.json', dict(schema=1, updates=[dict(self.row, coordinate=dict(lat=36, lng=139))]))
        with self.assertRaises(ValueError):
            self.run_audit()
        self.write('followup.json', dict(schema=1, updates=[self.row]))
        self.manifest['locations'] *= 2
        self.write('manifest.json', self.manifest)
        with self.assertRaises(ValueError):
            self.run_audit()

    def test_candidate_does_not_imply_adoption(self):
        def mutate(d):
            d['unresolved'].pop(1)
            d['updates'].append(dict(facilityId='facility:13', coordinate=dict(lat=35, lng=139)))
        self.change_region(mutate)
        r = self.run_audit()
        self.assertEqual(r['summary']['regionalCandidates'], 1)
        self.assertEqual(r['summary']['candidateNotAdopted'], 1)
        self.assertEqual(r['summary']['currentAdopted'], 1)

    def test_generated_coordinate_and_pin_are_separate(self):
        self.write('full.json', dict(schema=1, places=[dict(id='facility:0', coordinate=dict(
            status='confirmed', lat=35, lng=139))], pins=[]))
        self.write('ledger.json', dict(schema=1, places=[dict(id='facility:0', coordinate=self.row['coordinate'])]))
        r = self.run_audit(full='full.json', ledger='ledger.json')
        self.assertEqual(r['summary']['currentIntegrated'], 1)
        self.assertEqual(r['summary']['adoptedLocationNotGenerated'], 0)
        self.assertEqual(r['summary']['targetPins'], 0)
        self.assertEqual(r['summary']['ledgerAdoptedMatches'], 1)
        self.write('full.json', dict(schema=1, places=[], pins=[]))
        self.assertEqual(self.run_audit(full='full.json')['summary']['adoptedLocationNotGenerated'], 1)

    def test_reject_duplicate_full_and_invalid_pin(self):
        for full in [dict(schema=1, places=[dict(id='facility:0')]*2, pins=[]),
                     dict(schema=1, places=[], pins=[dict(id='facility:0', kind='place', lat=35, lng=139)])]:
            self.write('full.json', full)
            with self.assertRaises(ValueError):
                self.run_audit(full='full.json')

    def test_full_can_include_legacy_place_ids(self):
        self.write('full.json', dict(schema=1, places=[dict(id='place:legacy')], pins=[]))
        self.assertEqual(self.run_audit(full='full.json')['summary']['targetPins'], 0)

    def test_repository_inputs_without_work_dependency(self):
        root = Path(__file__).resolve().parents[2]
        result = audit.audit(root)
        self.assertEqual(result['summary']['assigned'], 810)
        self.assertEqual(len(result['locationSelection']['baselineLocationIds']), 642)
        self.assertFalse(any(p.startswith('data/work/') for p in result['inputSHA256']))

    def test_reject_baseline_duplicates_and_overlap(self):
        p = self.root / 'baseline.json'
        d = json.loads(p.read_text())
        d['baselineLocationIds'][0] = 'facility:0'
        self.write('baseline.json', d)
        with self.assertRaises(ValueError):
            self.run_audit()

    def test_cli_never_overwrites(self):
        p = self.root / 'out.json'
        p.write_text('keep')
        proc = subprocess.run([sys.executable, str(Path(audit.__file__)), '--root', str(self.root),
            '--baseline', 'baseline.json', '--manifest', 'manifest.json', '--regions-dir', 'regions',
            '--out', str(p)], capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertEqual(p.read_text(), 'keep')


if __name__ == '__main__':
    unittest.main()
