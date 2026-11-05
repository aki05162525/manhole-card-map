"""Regression cases for claims that the first verifier wrongly accepted."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('tohoku_verify', Path(__file__).with_name('verify.py'))
module = importlib.util.module_from_spec(spec)
with patch.object(sys, 'argv', ['verify.py']):
    spec.loader.exec_module(module)

class ResearchValidationTest(unittest.TestCase):
    def setUp(self):
        self.row = {'facilityId': 'test:a', 'sourceIds': ['plan.pdf'],
                    'stage': 'building-comparison', 'comparisonRef': 'c1'}
        self.facts = [{'sourceId': 'plan.pdf'}]
        self.comparisons = [{'id': 'c1', 'facilityIds': ['test:a'], 'performed': True,
                             'positiveEvidence': ['shape matches'], 'limitations': ['generalization']}]

    def validate(self):
        module.validate_claims([self.row], self.facts, self.comparisons)

    def test_missing_fact_is_rejected(self):
        self.facts.clear()
        with self.assertRaisesRegex(ValueError, 'fact'): self.validate()

    def test_unperformed_comparison_is_rejected(self):
        self.comparisons[0]['performed'] = False
        with self.assertRaisesRegex(ValueError, 'performed'): self.validate()

    def test_wrong_facility_comparison_is_rejected(self):
        self.comparisons[0]['facilityIds'] = ['test:other']
        with self.assertRaisesRegex(ValueError, 'facility'): self.validate()

    def test_missing_comparison_is_rejected(self):
        self.row['comparisonRef'] = None
        with self.assertRaisesRegex(ValueError, 'comparison'): self.validate()

    def test_source_review_does_not_require_vector_comparison(self):
        self.row.update(stage='source-review', comparisonRef=None)
        self.validate()

    def test_documented_comparison_passes(self): self.validate()

if __name__ == '__main__': unittest.main()
