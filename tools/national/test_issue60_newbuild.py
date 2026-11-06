"""Three approvals extend, rather than rewrite, the fixed 133-row baseline."""
import copy
import unittest
from pathlib import Path
from assemble import assemble, read_json

ROOT = Path(__file__).resolve().parents[2]
COORDINATES = {'facility:kanto-north-3f70fe18aa4d98644d5b': {'lat': 36.1322222, 'lng': 139.2455629}, 'facility:kanto-north-e199c890078d5d73c908': {'lat': 36.1170384, 'lng': 139.1949524}, 'facility:kanto-north-071cd7f65ad7c1a06c54': {'lat': 36.358053, 'lng': 139.5925051}}

class NewbuildAdoptionTests(unittest.TestCase):
    def test_only_newbuild_positions_change_and_all_133_adoptions_survive(self):
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        base = copy.deepcopy(manifest)
        for key in ('locations','locationLifecycle'):
            base[key] = [r for r in base[key] if '/newbuild-followup/' not in r['path']]
        self.assertEqual(read_json(ROOT / 'data/evidence/issue60/newbuild-followup/baseline-manifest.json'),base)
        before,_ = assemble(ROOT,base)
        after,_ = assemble(ROOT,manifest)
        old = {p['id']:p for p in before['places']}
        new = {p['id']:p for p in after['places']}
        self.assertEqual(set(COORDINATES),{fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(old.keys(),new.keys())
        self.assertEqual(before['relations'],after['relations'])
        self.assertEqual(1670,len(after['relations']))
        adopted = {r['facilityId'] for entry in base['locations'] if entry['path'].startswith('data/national/issue76/') for r in read_json(ROOT / entry['path'])['updates']}
        self.assertEqual(133,len(adopted))
        for fid in adopted:
            self.assertEqual(old[fid],new[fid])
        for fid,coordinate in COORDINATES.items():
            self.assertIsNone(old[fid].get('coordinate'))
            self.assertEqual(coordinate,new[fid]['coordinate'])
            self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},
                                                                                {k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
        for fid in ('facility:kanto-north-ab5de7e90313a0f18ac5', 'facility:kanto-north-88ee40433ca2bfde9534'):
            self.assertIsNone(new[fid].get('coordinate'))
        self.assertEqual((455,452),tuple(sum(p.get('coordinate') is None for p in ps.values()) for ps in (old,new)))

    def test_preserved_inputs_and_current_index_reproduce(self):
        from issue60_newbuild import prepare
        from issue76_remaining import build
        for path,expected in prepare(ROOT).items():
            self.assertEqual(expected,read_json(ROOT/path),path)
        index=build(ROOT)
        self.assertEqual(index,read_json(ROOT/'data/national/issue76/remaining-index-after-newbuild.json'))
        self.assertEqual((452,9,136),tuple(index['summary'][k] for k in ('remaining','kantoHeld','issue76Adopted')))

if __name__ == '__main__': unittest.main()
