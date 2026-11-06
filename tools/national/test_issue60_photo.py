import copy
import unittest
from pathlib import Path
from assemble import assemble, read_json
from location_lifecycle import digest

ROOT=Path(__file__).resolve().parents[2]
SOURCE='data/evidence/issue60/photo-resolution'
POINTS={'facility:kanto-north-ab5de7e90313a0f18ac5':{'lat':36.4361209,'lng':139.9091953},'facility:kanto-north-88ee40433ca2bfde9534':{'lat':36.4057278,'lng':139.3307991}}
class PhotoTests(unittest.TestCase):
 def test_only_approved_two_change(self):
  before,_=assemble(ROOT,read_json(ROOT/SOURCE/'baseline-manifest.json'))
  after,_=assemble(ROOT,read_json(ROOT/'tools/national/manifest.json'))
  old={p['id']:p for p in before['places']};new={p['id']:p for p in after['places']}
  self.assertEqual(old.keys(),new.keys());self.assertEqual(set(POINTS),{fid for fid in old if old[fid]!=new[fid]})
  self.assertEqual(before['relations'],after['relations']);self.assertEqual(1670,len(after['relations']))
  for fid,co in POINTS.items():
   self.assertNotIn('coordinate',old[fid]);self.assertEqual(co,new[fid]['coordinate'])
   self.assertEqual({k:v for k,v in old[fid].items() if k not in ('coordinate','evidence','locationReview')},{k:v for k,v in new[fid].items() if k not in ('coordinate','evidence','locationReview')})
 def test_fixed_packages_and_index(self):
  from issue60_photo_resolution import prepare
  from issue76_remaining import build
  for path,expected in prepare(ROOT).items(): self.assertEqual(expected,read_json(ROOT/path),path)
  index=build(ROOT)
  self.assertEqual((444,1,138,6),tuple(index['summary'][k] for k in ('remaining','kantoHeld','issue76Adopted','manualUserApproved')))
  self.assertEqual(index,read_json(ROOT/'data/national/issue60/remaining-index-after-photo.json'))
