"""Three approvals extend, rather than rewrite, the fixed 130-row baseline."""
import copy
import unittest
from pathlib import Path
from assemble import assemble, read_json

ROOT = Path(__file__).resolve().parents[2]
COORDINATES = {'facility:kanto-south-integration-11': {'lat': 35.4341084, 'lng': 139.4307518}, 'facility:kanto-north-shiraoka-temporary-shoko': {'lat': 36.0176222, 'lng': 139.6776589}, 'facility:kanto-north-2384f4b5d5bbd843bcbd': {'lat': 36.1947711, 'lng': 139.7097299}}

class ThreeAdoptionTests(unittest.TestCase):
    def test_only_three_positions_change_and_all_130_adoptions_survive(self):
        manifest = read_json(ROOT / 'data/evidence/issue60/manual-user-approval/baseline-manifest.json')
        base = copy.deepcopy(manifest)
        for key in ('locations','locationLifecycle'):
            base[key] = [r for r in base[key] if '/three-followup/' not in r['path']]
        self.assertEqual(read_json(ROOT / 'data/evidence/issue60/three-followup/baseline-manifest.json'),base)
        before,_ = assemble(ROOT,base)
        after,_ = assemble(ROOT,manifest)
        old = {p['id']:p for p in before['places']}
        new = {p['id']:p for p in after['places']}
        self.assertEqual(set(COORDINATES),{fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(old.keys(),new.keys())
        self.assertEqual(before['relations'],after['relations'])
        self.assertEqual(1670,len(after['relations']))
        adopted = {r['facilityId'] for entry in base['locations'] if entry['path'].startswith('data/national/issue76/') for r in read_json(ROOT / entry['path'])['updates']}
        self.assertEqual(130,len(adopted))
        for fid in adopted:
            self.assertEqual(old[fid],new[fid])
        for fid,coordinate in COORDINATES.items():
            self.assertIsNone(old[fid].get('coordinate'))
            self.assertEqual(coordinate,new[fid]['coordinate'])
            self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},
                                                                                {k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
        outdoor = new['facility:kanto-south-integration-11']
        self.assertIn('屋外配布区画の代表点', outdoor['evidence']['verificationMethod'])
        self.assertEqual('Adopted facility representative point', outdoor['locationReview']['reason'])
        self.assertEqual((458,455),tuple(sum(p.get('coordinate') is None for p in ps.values()) for ps in (old,new)))

    def test_preserved_inputs_and_current_index_reproduce(self):
        from issue60_three import prepare
        from issue76_remaining import build
        for path,expected in prepare(ROOT).items():
            self.assertEqual(expected,read_json(ROOT/path),path)
        from historical_test_root import before_manual
        with before_manual(ROOT) as historical:
            index=build(historical)
        self.assertEqual(index,read_json(ROOT/'data/national/issue76/remaining-index-after-three.json'))
        self.assertEqual((455,12,133),tuple(index['summary'][k] for k in ('remaining','kantoHeld','issue76Adopted')))

if __name__ == '__main__': unittest.main()
