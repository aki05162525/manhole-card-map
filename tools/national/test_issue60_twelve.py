"""Integration boundary for the twelve explicitly approved November 6 candidates."""
import copy
import unittest
from pathlib import Path
from assemble import assemble, read_json

ROOT = Path(__file__).resolve().parents[2]
SUFFIXES = ['e9b95c73682cd106b4e8','f45d3f2e581350eedec5','cfbbd4559bc94f487c62',
            '08db6f2252ed32919222','1a5c86a3e21c20b9dcc2','2bef1ef8fe90f960751c',
            '338d33c309d5e44859e4','6193af412ca73d91d288','9c30c84d390ac7961fee']
IDS = {'facility:kanto-north-' + s for s in SUFFIXES} | {
    'facility:kanto-south-668322fd5a7c4bbcbf55', 'facility:kanto-south-d4aaa6f664279d04fc85',
    'facility:kanto-south-integration-05'}

class TwelveAdoptionTests(unittest.TestCase):
    def test_preserved_inputs_and_transformation_reproduce(self):
        from issue60_twelve import prepare
        from issue76_remaining import build
        for path, expected in prepare(ROOT).items():
            self.assertEqual(expected, read_json(ROOT / path), path)
        from historical_test_root import before_four
        with before_four(ROOT) as historical:
            index = build(historical)
        self.assertEqual(index, read_json(ROOT / 'data/national/issue76/remaining-index-after-twelve.json'))
        self.assertEqual((462, 19, 126), tuple(index['summary'][k] for k in ('remaining', 'kantoHeld', 'issue76Adopted')))

    def test_only_twelve_approved_positions_change(self):
        manifest = read_json(ROOT / 'data/evidence/issue60/four-followup/baseline-manifest.json')
        base = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            base[key] = [r for r in base[key] if '/twelve-followup/' not in r['path']]
        before, _ = assemble(ROOT, base)
        after, _ = assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(IDS, {fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual(1670, len(after['relations']))
        for fid in IDS:
            self.assertIsNone(old[fid].get('coordinate'))
            self.assertIsNotNone(new[fid].get('coordinate'))
            self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},
                             {k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
        self.assertEqual((474,462), tuple(sum(p.get('coordinate') is None for p in ps.values()) for ps in (old,new)))

if __name__ == '__main__':
    unittest.main()
