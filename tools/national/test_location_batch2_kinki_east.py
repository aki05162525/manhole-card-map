"""Research packet contracts; do not freeze the current national unlocated count."""
import importlib.util
import json
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

class AdoptionTests(unittest.TestCase):
    def test_exact_two_adoptions_keep_other_regions_and_six_holds(self):
        import copy
        import hashlib
        import assemble as a
        prefix = 'data/national/location-batch2/kinki-east/'
        points = {'facility:kinki-5d739ed0da591dafd1d2':{'lat':34.8324063,'lng':136.5714216}, 'facility:kinki-5d377b6a926c0d1e6fa1':{'lat':34.9080456,'lng':135.7071966}}
        manifest = a.read_json(ROOT/'tools/national/manifest.json')
        baseline = copy.deepcopy(manifest)
        for key in ['locations','locationLifecycle']:
            baseline[key] = [s for s in baseline[key] if not s['path'].startswith(prefix)]
        before,_ = a.assemble(ROOT,baseline)
        after,_ = a.assemble(ROOT,manifest)
        old={p['id']:p for p in before['places']}; new={p['id']:p for p in after['places']}
        self.assertEqual(before['relations'],after['relations'])
        self.assertEqual(old.keys(),new.keys())
        for fid,coord in points.items():
            self.assertNotIn('coordinate',old[fid])
            self.assertEqual(new[fid].get('coordinate'),coord)
        digest=lambda v:hashlib.sha256(json.dumps(v,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        prior=a.read_json(ROOT/(prefix+'prior-values.json'))
        proposals=a.read_json(ROOT/(prefix+'locations.json'))['updates']
        bindings=a.read_json(ROOT/(prefix+'location-lifecycle.json'))['bindings']
        self.assertEqual({b['facilityId'] for b in bindings},set(points))
        self.assertEqual({r['facilityId'] for r in proposals},set(points))
        for b in bindings:
            fid=b['facilityId']; row=next(r for r in proposals if r['facilityId']==fid)
            saved=next(r for r in prior['rows'] if r['facilityId']==fid)
            self.assertEqual(saved['previousPlace'],old[fid])
            self.assertEqual(saved['previousPlaceSHA256'],digest(old[fid]))
            original=a.read_json(ROOT/'data/national/issue7/kinki-east.json')['unresolved'][int(saved['originalRef'].rsplit('/',1)[1])]
            self.assertEqual(saved['originalRow'],original)
            self.assertEqual(saved['originalRowSHA256'],digest(original))
            self.assertEqual(b['identity'],{k:old[fid][k] for k in ['name','address']})
            self.assertEqual(b['adoption'],row)
            self.assertEqual(b['adoptionSHA256'],digest(row))
        for fid in old:
            if fid in points:
                self.assertEqual({k:v for k,v in new[fid].items() if k not in ['coordinate','evidence','locationReview']},{k:v for k,v in old[fid].items() if k!='evidence'})
                self.assertEqual(new[fid]['locationReview']['status'],'confirmed')
            else:self.assertEqual(new[fid],old[fid])
        selected={r['facilityId'] for r in a.read_json(ROOT/(prefix+'selection.json'))['rows'] if r['selection']=='selected'}
        held=selected-points.keys()
        self.assertEqual(len(held),6)
        for fid in held:self.assertNotIn('coordinate',new[fid])
        self.assertEqual(sum('coordinate' not in p for p in old.values())-sum('coordinate' not in p for p in new.values()),2)
