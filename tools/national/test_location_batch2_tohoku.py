import importlib.util
import sys
from unittest.mock import patch
import copy
import json
import hashlib
from pathlib import Path
import unittest
import assemble as a

ROOT = Path(__file__).resolve().parents[2]
PREFIX = 'data/national/location-batch2/tohoku/'
EXPECTED = {
    'facility:north-db757b448c8db73422a5': {'lat': 39.3885493, 'lng': 141.1168429},
    'facility:north-e2dfc05c8b1db51fc65b': {'lat': 39.478372, 'lng': 141.9535192},
}

# Make the research regression cases part of the standard CI discovery.
_spec = importlib.util.spec_from_file_location('tohoku_research_tests',
    ROOT / 'data/evidence/location-batch2/tohoku/test_verify.py')
_research = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_research)
ResearchValidationTest = _research.ResearchValidationTest

class TohokuLocationBatch2Test(unittest.TestCase):
    def test_research_records_and_regional_integration(self):
        # Preserve the original verifier and its historical manifest contract.
        # The next test separately validates Tohoku against today's manifest.
        original_load = _research.module.load

        def historical_load(path):
            if path == ROOT / 'tools/national/manifest.json':
                path = ROOT / 'data/evidence/issue76/baseline-manifest.json'
            return original_load(path)

        with patch.object(sys, 'argv', ['verify.py']), patch.object(_research.module, 'load', historical_load):
            _research.module.main()

    def test_two_buildings_and_only_their_position_fields_change(self):
        manifest = a.read_json(ROOT / 'tools/national/manifest.json')
        historical = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            historical[key] = [p for p in historical.get(key, []) if not p['path'].startswith(PREFIX)]
        before, _ = a.assemble(ROOT, historical)
        after, _ = a.assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual({fid for fid in old if old[fid] != new[fid]}, set(EXPECTED))
        for fid, coordinate in EXPECTED.items():
            self.assertNotIn('coordinate', old[fid])
            self.assertEqual(new[fid]['coordinate'], coordinate)
            self.assertEqual(new[fid]['locationReview']['status'], 'confirmed')
            self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},
                             {k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
        for previous in a.read_json(ROOT / (PREFIX + 'previous-places.json'))['rows']:
            self.assertEqual(previous['previousPlace'], old[previous['facilityId']])
            self.assertEqual(previous['previousPlaceSHA256'], hashlib.sha256(
                json.dumps(previous['previousPlace'], sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        bindings = [b for s in manifest.get('locationLifecycle', []) if s['path'].startswith(PREFIX)
                    for b in a.read_json(ROOT / s['path'])['bindings']]
        self.assertEqual({b['facilityId'] for b in bindings}, set(EXPECTED))
        for b in bindings:
            p = new[b['facilityId']]
            self.assertEqual(b['identity'], {k:p[k] for k in ('name','address')})
            self.assertEqual(b['adoption']['coordinate'], p['coordinate'])
            self.assertEqual(b['adoption']['evidence'], p['evidence'])
        selected = a.read_json(ROOT / (PREFIX + 'selection.json'))['selected']
        for r in selected:
            if r['facilityId'] not in EXPECTED:
                self.assertEqual(old[r['facilityId']], new[r['facilityId']])
                self.assertNotIn('coordinate', new[r['facilityId']])

if __name__ == '__main__': unittest.main()
