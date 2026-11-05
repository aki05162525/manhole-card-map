"""Research-only regional checks must survive other regions' adoptions."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ResearchOnlyTest(unittest.TestCase):
    def test_historical_baseline_and_current_region_are_separate(self):
        result = subprocess.run(
            [sys.executable, '-B', 'data/evidence/location-batch2/tokai/verify.py'],
            cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['baselineNationalUnlocated'], 608)
        self.assertEqual(report['currentRegionalChangedIds'], [])
        self.assertIn('currentNationalUnlocated', report)


if __name__ == '__main__':
    unittest.main()
