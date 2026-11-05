import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('pilot_verify',Path(__file__).with_name('verify.py'))
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

class PilotValidationTest(unittest.TestCase):
    def setUp(self):
        self.selection={'selected':2,'population':3,'rows':[{'facilityId':'a','selected':True},{'facilityId':'b','selected':True},{'facilityId':'c','selected':False}]}
        self.outcomes={'adopted':0,'rows':[{'facilityId':'a','decision':'held','adoptedCoordinate':None},{'facilityId':'b','decision':'held','adoptedCoordinate':None}]}
    def test_duplicate_outcomes_cannot_hide_missing_facility(self):
        self.outcomes['rows'][1]['facilityId']='a'
        with self.assertRaisesRegex(ValueError,'coverage'):
            v.validate_summary(self.selection,self.outcomes)
    def test_arithmetic_does_not_authorize_adoption(self):
        self.outcomes['rows'][0]['adoptedCoordinate']={'lat':35,'lng':139}
        with self.assertRaisesRegex(ValueError,'research-only'):
            v.validate_summary(self.selection,self.outcomes)
    def test_unchanged_holds_cover_selection(self):
        v.validate_summary(self.selection,self.outcomes)
    def test_mixed_range_generations_rejected(self):
        with self.assertRaisesRegex(ValueError,'generation'):
            v.check_generation([{'etag':'one','lastModified':'date'},{'etag':'two','lastModified':'date'}])

if __name__=='__main__':unittest.main()
