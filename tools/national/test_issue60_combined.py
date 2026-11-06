"""Merged independent approvals and six user exceptions retain all relationships."""
import unittest
from pathlib import Path
from assemble import assemble, apply_locations, read_json
from issue76_remaining import build

ROOT = Path(__file__).resolve().parents[2]
EXTRA = {
 'facility:kanto-south-c673e03f2340f9a5bfef': {'lat':35.710431,'lng':139.805807},
 'facility:kanto-south-integration-10': {'lat':35.18845,'lng':139.65330},
 'facility:kanto-south-integration-legacy-yachiyo-1': {'lat':35.72350,'lng':140.10600},
}
class CombinedTests(unittest.TestCase):
 def test_only_extra_three_change_from_merged_baseline(self):
  before,_=assemble(ROOT,read_json(ROOT/'data/evidence/issue60/manual-user-additional/baseline-manifest.json'))
  after,_=assemble(ROOT,read_json(ROOT/'tools/national/manifest.json'))
  old={p['id']:p for p in before['places']};new={p['id']:p for p in after['places']}
  self.assertEqual(old.keys(),new.keys())
  self.assertEqual(set(EXTRA),{fid for fid in old if old[fid]!=new[fid]})
  self.assertEqual(before['relations'],after['relations']);self.assertEqual(1670,len(after['relations']))
  for fid,co in EXTRA.items():
   self.assertNotIn('coordinate',old[fid]);self.assertEqual(co,new[fid]['coordinate'])
   self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},{k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
  self.assertIn('敷地代表点',new['facility:kanto-south-integration-legacy-yachiyo-1']['locationReview']['reason'])
  from test_issue60_manual import POINTS
  from test_issue60_newbuild import COORDINATES
  from test_issue60_three import COORDINATES as prior
  for fid,co in (POINTS|COORDINATES|prior).items(): self.assertEqual(co,new[fid]['coordinate'])
 def test_additional_scope_and_superseded_values_rejected(self):
  baseline,_=assemble(ROOT,read_json(ROOT/'data/evidence/issue60/manual-user-additional/baseline-manifest.json'))
  updates=read_json(ROOT/'data/national/issue60/manual-user-additional/locations.json')['updates']
  for update in updates:
   fid=update['facilityId']
   bad={'facility:kanto-south-integration-10':{'lat':35.1889,'lng':139.6538},'facility:kanto-south-integration-legacy-yachiyo-1':{'lat':35.7208,'lng':140.1005}}.get(fid)
   if bad:
    with self.subTest(fid=fid),self.assertRaises(ValueError):
     apply_locations(baseline,[dict(update,coordinate=bad)],ROOT)
   if fid.endswith('legacy-yachiyo-1'):
    missing_mode = dict(update)
    missing_mode.pop('approvalMode')
    with self.assertRaises(ValueError):
     apply_locations(baseline,[missing_mode],ROOT)
    with self.assertRaises(ValueError):
     apply_locations(baseline,[dict(update,scope='user-designated-center')],ROOT)
 def test_current_index(self):
  index=build(ROOT)
  self.assertEqual((446,3,136,6),tuple(index['summary'][k] for k in ('remaining','kantoHeld','issue76Adopted','manualUserApproved')))
  self.assertEqual(index,read_json(ROOT/'data/national/issue60/remaining-index-combined.json'))

if __name__=='__main__': unittest.main()
