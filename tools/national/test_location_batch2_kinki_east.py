"""Research packet contracts; do not freeze the current national unlocated count."""
import importlib.util
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('kinki_packet', ROOT / 'data/evidence/location-batch2/kinki-east/verify.py')

class PacketTests(unittest.TestCase):
    def module(self):
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return m

    def test_rejects_non_200_source_even_if_not_referenced(self):
        with self.assertRaisesRegex(AssertionError, 'status'):
            self.module().validate_sources([{'status': 404}], ROOT, False)

    def test_rejects_disagreeing_decision(self):
        with self.assertRaisesRegex(AssertionError, 'decision'):
            self.module().validate_counts({'rows': [{'facilityId':'x','status':'held'}], 'selected':1, 'held':1, 'adopted':0}, {'heldIds': [], 'adoptedIds':[]})

    def test_rejects_raw_byte_count_mismatch(self):
        p = Path(__file__)
        import hashlib
        row = {'status':200, 'rawPath':str(p), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes':1, 'sourceVersion':'test'}
        with self.assertRaisesRegex(AssertionError, 'bytes'):
            self.module().validate_sources([row], ROOT, True)

    def test_valid_counts_and_source_pass(self):
        import hashlib
        p = Path(__file__)
        self.module().validate_sources([{'status':200, 'rawPath':str(p), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes':p.stat().st_size, 'sourceVersion':'test'}], ROOT, True)
        self.module().validate_counts({'rows':[{'facilityId':'x','status':'held'}], 'selected':1, 'held':1, 'adopted':0}, {'heldIds':['x'], 'adoptedIds':[]})

    def test_rejects_candidate_not_matching_derived_point(self):
        with self.assertRaisesRegex(AssertionError, 'candidate coordinate'):
            self.module().validate_candidates([{'numericalKey':'x','coordinate':{'lng':135,'lat':0}}], [{'key':'x','pointLngLat':[135,35],'roundedInside':True}])
