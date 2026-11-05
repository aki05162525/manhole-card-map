"""Read-only validation for the unapproved Tochigi selection proposal."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
CHECK = ROOT / 'data/evidence/kanto-prefecture/tochigi/batch2/check.py'
SELECTION = ROOT / 'data/national/kanto-prefecture/tochigi/batch2-selection-proposed.json'


class TochigiSelectionTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('tochigi_batch2_check', CHECK)
        self.check = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.check)
        self.selection = json.loads(SELECTION.read_text())
        self.original = SELECTION.read_bytes()

    def tearDown(self):
        self.assertEqual(SELECTION.read_bytes(), self.original)

    def test_existing_selection_is_valid_without_rewriting(self):
        rows = self.check.check_selected_inputs(ROOT, self.selection)
        self.assertEqual({r['facilityId'] for r in rows},
                         {r['facilityId'] for s in self.selection['locations'] for r in s['approved']})

    def test_bad_selected_hash_is_rejected_without_repair(self):
        changed = copy.deepcopy(self.selection)
        changed['locations'][0]['approved'][0]['sha256'] = '0' * 64
        original = copy.deepcopy(changed)
        with self.assertRaisesRegex(ValueError, 'selected update hash'):
            self.check.check_selected_inputs(ROOT, changed)
        self.assertEqual(changed, original)

    def test_unknown_selected_id_is_rejected(self):
        changed = copy.deepcopy(self.selection)
        changed['locations'][0]['approved'][0]['facilityId'] = 'facility:not-in-proposal'
        with self.assertRaisesRegex(ValueError, 'selected update missing'):
            self.check.check_selected_inputs(ROOT, changed)

    def test_missing_lifecycle_collections_are_rejected(self):
        original_read = self.check.read

        def read_without_events(path):
            document = original_read(path)
            if 'bindings' in document:
                document.pop('events', None)
            return document

        with mock.patch.object(self.check, 'read', side_effect=read_without_events):
            with self.assertRaisesRegex(ValueError, 'lifecycle fields'):
                self.check.check_selected_inputs(ROOT, self.selection)
