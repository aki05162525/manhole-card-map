"""Research-only contract: evidence corrections must not select any location."""
import hashlib
import json
from pathlib import Path
import unittest
from national_audit import STAGES

ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'data/national/location-batch2/hokuriku'
E = ROOT / 'data/evidence/location-batch2/hokuriku'

class HokurikuResearchTests(unittest.TestCase):
    def test_stages_and_corrected_stops(self):
        rows = json.loads((D / 'outcomes.json').read_text())['rows']
        for row in rows:
            self.assertIn(row['stage'], STAGES)
            self.assertIsNone(row['coordinate'])
            self.assertIsNone(row['adoptionBinding'])
        for row in rows[:2]:
            self.assertNotIn('西側隣接タイル', row['resumeCondition'])
            self.assertNotIn('結合', row['resumeCondition'])
        self.assertEqual(rows[-1]['stage'], 'retrieved')

    def test_actual_comparison_and_rounded_interior(self):
        data = json.loads((E / 'building-comparisons.json').read_text())
        self.assertEqual(data['sadoExcluded29']['bounds'][0], -39)
        self.assertFalse(data['sadoExcluded29']['touchesBufferLimit'])
        self.assertTrue(data['sadoExcluded29']['roadSeparates'])
        self.assertEqual(len(data['sawataP05']), 4)
        self.assertTrue(all(p['inside253'] for p in data['sawataP05']))
        self.assertEqual({r['id'] for r in data['representativeStudies']}, {'sado-first', 'asahi-product'})
        for row in data['representativeStudies']:
            self.assertTrue(row['centroidInsidePart'])
            self.assertTrue(row['roundedInsidePart'])
            self.assertTrue(row['roundedInsideWhole'])
            self.assertGreater(row['roundedBoundaryClearanceApproxMetres'], 5)
        self.assertTrue(data['fukui']['comparedFeatureIndices'])

    def test_manifest_and_all_original_inputs_unchanged(self):
        selection = json.loads((D / 'selection.json').read_text())
        for path, expected in selection['inputSHA256'].items():
            source = E / 'baseline-manifest.json' if path == 'tools/national/manifest.json' else ROOT / path
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), expected, path)
        manifest = json.loads((ROOT / 'tools/national/manifest.json').read_text())
        self.assertNotIn('location-batch2/hokuriku', json.dumps(manifest))

if __name__ == '__main__':
    unittest.main()
