import hashlib
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest

import location_priorities as p


def row(fid, statuses, matching=True, verified=True):
    return dict(facilityId=fid, name='Hall', address='Address', locationStatus='unlocated',
                axes=dict(facilityRegistered=True, distributionStatuses=statuses, relationUnconfirmed=not verified),
                generated=dict(matchesCurrentRelations=matching), investigation=dict(stage='not-evaluated', reviews=[{'decision':'held'}]),
                provenance={'original':{'reason':'unverified'}}, priority=dict(requested=None, regionalGap=None, firstPinCardIds=['card:a']),
                reconfirmationSignals=[])


class PriorityTests(unittest.TestCase):
    def report(self, rows):
        return dict(schema=1, facilities=rows, national={'assembledUnlocated':len(rows)}, dates={}, inputSHA256={})

    def test_mixed_unknown_and_generation_difference_never_end_only(self):
        rows=[row('a',['ended']),row('b',['ended','active']),row('c',['ended'],False),row('d',['ended','unknown']),row('e',['active'],verified=False)]
        result=p.classify(self.report(rows))
        actual={r['facilityId']:r for r in result['facilities']}
        self.assertEqual(actual['a']['distribution']['classification'],'ended-only')
        self.assertEqual(actual['b']['distribution']['classification'],'mixed')
        for fid in ['c','d','e']:
            self.assertEqual(actual[fid]['distribution']['classification'],'needs-review')
            self.assertIn('配布関係',actual[fid]['nextAction'])
            self.assertIsNone(actual[fid]['firstPinCardIds'])
        self.assertEqual(actual['b']['priority']['requested'],None)
        self.assertEqual(actual['b']['investigation']['reviews'],[{'decision':'held'}])

    def test_hold_keeps_conditions_and_joint_candidates_do_not_merge(self):
        report=self.report([row('a',['active']),row('b',['active'])])
        hold={'facilityId':'a','status':'held','stopCondition':'do not repeat','resumeCondition':'new source','stage':'numeric-search'}
        result=p.classify(report,holds={'a':hold})
        a=next(r for r in result['facilities'] if r['facilityId']=='a')
        self.assertEqual(a['hold'],hold)
        self.assertEqual(a['reevaluateWhen'],'new source')
        self.assertEqual(result['summary']['facilities'],2)
        self.assertEqual(result['sharedInvestigationCandidates'][0]['facilityIds'],['a','b'])
        self.assertEqual(result['coverage']['facilityIds'],['a','b'])

    def test_missing_generation_and_stage_are_distinct_unknowns(self):
        a=row('a',None);a['generated']=None
        result=p.classify(self.report([a]))['facilities'][0]
        self.assertEqual(result['distribution']['classification'],'not-evaluated')
        self.assertEqual(result['investigation']['stage'],'not-evaluated')
        self.assertIn('配布関係',result['nextAction'])

    def test_duplicate_or_missing_population_rejected(self):
        with self.assertRaises(ValueError):p.classify(self.report([row('a',[]),row('a',[])]))
        report=self.report([row('a',[])]);report['national']['assembledUnlocated']=2
        with self.assertRaises(ValueError):p.classify(report)

    def test_input_full_hash_and_hold_coverage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            full={'places':[],'relations':[]};raw=json.dumps(full).encode();(root/'full.json').write_bytes(raw)
            report=self.report([row('a',['active'])]);report['inputSHA256']={'full.json':hashlib.sha256(raw).hexdigest()}
            (root/'audit.json').write_text(json.dumps(report))
            self.assertEqual(p.build(root,'audit.json',full='full.json')['summary']['facilities'],1)
            (root/'full.json').write_text('{}')
            with self.assertRaises(ValueError):p.build(root,'audit.json',full='full.json')
            (root/'selection.json').write_text(json.dumps({'schema':1,'groups':[{'facilityIds':['a']}]}))
            with self.assertRaises(ValueError):p.build(root,'audit.json',hold_selection='selection.json')

    def test_group_hold_format_and_unlocated_conflict_priority(self):
        a=row('a',['active']);b=row('b',['active'])
        b['investigation']['blockers']=['relocation']
        self.assertEqual(p.classify(self.report([a,b]))['facilities'][0]['facilityId'],'b')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'audit.json').write_text(json.dumps(self.report([a,b])))
            hold={'schema':1,'groups':[{'facilityIds':['a','b'],'status':'held','stopReason':'same source','resumeWhen':['new geometry','terms checked']}]}
            (root/'holds.json').write_text(json.dumps(hold))
            result=p.build(root,'audit.json',hold_outcomes=['holds.json'])
            self.assertEqual(result['summary']['heldFacilities'],2)
            self.assertEqual(result['facilities'][0]['hold']['resumeWhen'],['new geometry','terms checked'])

    def test_strict_json_and_output_overwrite_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for invalid in ['{"schema":1,"schema":1}', '{"schema":NaN}']:
                (root/'audit.json').write_text(invalid)
                with self.assertRaises(ValueError):p.build(root,'audit.json')
            out=root/'existing.json';out.write_text('keep')
            result=subprocess.run([sys.executable,str(Path(p.__file__)), '--root',str(root),'--audit','audit.json','--out',str(out)],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('output already exists',result.stderr)
            self.assertEqual(out.read_text(),'keep')

    def test_relation_rows_and_unique_cards_count_separately(self):
        report=self.report([row('a',['active'])]);full={'relations':[{'placeId':'a','cardId':'x','status':'active','review':'verified'}]*2}
        result=p.classify(report,full=full)
        self.assertEqual(result['summary']['relationStatusCounts'],{'active':2})
        self.assertEqual(result['summary']['firstPinCandidateCardCount'],1)
        self.assertEqual(len(result['facilities'][0]['generatedRelations']),2)


if __name__=='__main__':unittest.main()
