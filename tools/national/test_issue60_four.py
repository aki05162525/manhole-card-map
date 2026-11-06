"""Four approvals extend, rather than rewrite, the fixed 126-row baseline."""
import copy
import unittest
from pathlib import Path
from assemble import assemble, read_json

ROOT = Path(__file__).resolve().parents[2]
COORDINATES = {
    'facility:kanto-south-cdc3bc3e1d850a2e973d': {'lat':35.7376191,'lng':139.7850113},
    'facility:kanto-south-f8ee4ebfc645aa7894ed': {'lat':35.6989936,'lng':139.622291},
    'facility:kanto-north-80e64df38987c39b7386': {'lat':35.8139471,'lng':139.6416378},
    'facility:kanto-north-e2961b63ac4d4c596eb9': {'lat':36.0392008,'lng':139.4212176},
}

class FourAdoptionTests(unittest.TestCase):
    def test_only_four_positions_change_and_all_126_adoptions_survive(self):
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        base = copy.deepcopy(manifest)
        for key in ('locations','locationLifecycle'):
            base[key] = [r for r in base[key] if '/four-followup/' not in r['path']]
        self.assertEqual(read_json(ROOT / 'data/evidence/issue60/four-followup/baseline-manifest.json'),base)
        before,_ = assemble(ROOT,base)
        after,_ = assemble(ROOT,manifest)
        old = {p['id']:p for p in before['places']}
        new = {p['id']:p for p in after['places']}
        self.assertEqual(set(COORDINATES),{fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(old.keys(),new.keys())
        self.assertEqual(before['relations'],after['relations'])
        self.assertEqual(1670,len(after['relations']))
        adopted = {r['facilityId'] for entry in base['locations'] if entry['path'].startswith('data/national/issue76/') for r in read_json(ROOT / entry['path'])['updates']}
        self.assertEqual(126,len(adopted))
        for fid in adopted:
            self.assertEqual(old[fid],new[fid])
        for fid,coordinate in COORDINATES.items():
            self.assertIsNone(old[fid].get('coordinate'))
            self.assertEqual(coordinate,new[fid]['coordinate'])
            self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},
                                                                                {k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
        self.assertEqual((462,458),tuple(sum(p.get('coordinate') is None for p in ps.values()) for ps in (old,new)))

    def test_preserved_inputs_and_current_index_reproduce(self):
        from issue60_four import prepare
        from issue76_remaining import build
        for path,expected in prepare(ROOT).items():
            self.assertEqual(expected,read_json(ROOT/path),path)
        index=build(ROOT)
        self.assertEqual(index,read_json(ROOT/'data/national/issue76/remaining-index-after-four.json'))
        self.assertEqual((458,15,130),tuple(index['summary'][k] for k in ('remaining','kantoHeld','issue76Adopted')))

if __name__ == '__main__': unittest.main()
