import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import research_baseline as b


class ResearchBaselineTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = {'inputs': [], 'locations': [], 'locationLifecycle': []}
        self.baseline = {'places': [{'id': 'old'}], 'relations': []}
        for path in (b.BASELINE_MANIFEST, 'tools/national/manifest.json'):
            p = self.root / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b.serialized(self.manifest))
        self.selection = {'inputSHA256': {
            'tools/national/manifest.json': hashlib.sha256(b.serialized(self.manifest)).hexdigest(),
            'before.json': hashlib.sha256(b.serialized(self.baseline)).hexdigest()}}

    def test_other_region_adoption_does_not_change_historical_hash(self):
        current = copy.deepcopy(self.manifest)
        current['locations'] = [{'path': 'data/national/location-batch2/other/locations.json'}]
        (self.root / 'tools/national/manifest.json').write_bytes(b.serialized(current))
        def assemble(root, manifest):
            ledger = copy.deepcopy(self.baseline)
            if manifest['locations']:
                ledger['places'][0]['coordinate'] = {'lat': 35, 'lng': 139}
            return ledger, {}
        with patch.object(b, 'assemble', side_effect=assemble):
            before, after, report = b.check_research_only(self.root, 'target', self.selection, 'before.json')
        self.assertNotEqual(before, after)
        self.assertEqual(report['currentRegionalChangedIds'], [])
        self.assertEqual(report['baselineNationalUnlocated'], 1)
        self.assertEqual(report['currentNationalUnlocated'], 0)

    def test_region_cannot_silently_adopt_a_facility(self):
        current = copy.deepcopy(self.manifest)
        current['locations'] = [{'path': 'data/national/location-batch2/target/locations.json'}]
        (self.root / 'tools/national/manifest.json').write_bytes(b.serialized(current))
        def assemble(root, manifest):
            ledger = copy.deepcopy(self.baseline)
            if manifest['locations']:
                ledger['places'][0]['coordinate'] = {'lat': 35, 'lng': 139}
            return ledger, {}
        with patch.object(b, 'assemble', side_effect=assemble), self.assertRaisesRegex(ValueError, 'regional ledger changed'):
            b.check_research_only(self.root, 'target', self.selection, 'before.json')

    def test_regional_patch_and_input_cannot_change_research_only_ledger(self):
        for key in ('patches', 'inputs'):
            with self.subTest(key=key):
                current = copy.deepcopy(self.manifest)
                path = 'data/national/location-batch2/target/correction.json'
                current[key] = [path if key == 'inputs' else {'path': path}]
                (self.root / 'tools/national/manifest.json').write_bytes(b.serialized(current))
                def assemble(root, manifest):
                    ledger = copy.deepcopy(self.baseline)
                    if manifest.get(key):
                        ledger['places'][0]['name'] = 'changed'
                    return ledger, {}
                with patch.object(b, 'assemble', side_effect=assemble), self.assertRaisesRegex(ValueError, 'regional ledger changed'):
                    b.check_research_only(self.root, 'target', self.selection, 'before.json')

    def test_historical_manifest_tampering_is_rejected(self):
        (self.root / b.BASELINE_MANIFEST).write_text('{}')
        with self.assertRaisesRegex(ValueError, 'baseline manifest hash'):
            b.check_research_only(self.root, 'target', self.selection, 'before.json')

    def test_historical_ledger_tampering_is_rejected(self):
        with patch.object(b, 'assemble', return_value=({'places': [], 'relations': []}, {})), self.assertRaisesRegex(ValueError, 'baseline ledger hash'):
            b.check_research_only(self.root, 'target', self.selection, 'before.json')


if __name__ == '__main__':
    unittest.main()
