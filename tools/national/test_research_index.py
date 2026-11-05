import copy
import json
import assemble
from pathlib import Path
import unittest
import research_index as r

ROOT = Path(__file__).resolve().parents[2]

class ResearchIndexTest(unittest.TestCase):
    def test_group_history_and_json_pointer(self):
        value = {'groups': [{'facilityIds': ['a', 'b'], 'finding': 'shared'}]}
        self.assertEqual([(fid, p) for fid, p, _ in r.records(value)], [('a', '/groups/0'), ('b', '/groups/0')])

    def test_not_attempted_is_not_missing_source_or_failure(self):
        result = r.classify({'stopCondition': '外形の照合は未実施。'}, 'x#/0')
        self.assertEqual([x['category'] for x in result], ['comparison-not-performed'])
        result = r.classify({'stopCondition': '原本取得失敗 HTTP403。棟対応未確定。'}, 'x#/0')
        self.assertEqual({x['category'] for x in result}, {'retrieval-failed', 'building-unresolved'})

    def test_unknown_is_not_a_claim_of_failed_work(self):
        self.assertEqual(r.classify({}, 'x#/0')[0]['category'], 'execution-not-recorded')

    def test_completed_comparison_is_not_labelled_unperformed(self):
        result = r.classify({'stopCondition': '未着手を理由にした保留ではない。棟対応未確定。'}, 'x#/0')
        self.assertEqual([x['category'] for x in result], ['building-unresolved'])
        result = r.classify({'finding': 'CRSは確認済み。'}, 'x#/0')
        self.assertNotIn('conditions-unverified', [x['category'] for x in result])

    def test_duplicate_ids_rejected_and_adopted_excluded(self):
        places = [{'id':'a','name':'A'}, {'id':'b','coordinate':{'lat':1,'lng':2}}]
        result = r.assemble_index(places, {}, {}, {}, 'baseline', '2026-11-05')
        self.assertEqual([x['facilityId'] for x in result['facilities']], ['a'])
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            r.assemble_index(places + [copy.deepcopy(places[0])], {}, {}, {}, 'baseline', '2026-11-05')

    def test_grouped_queue_keeps_answered_separate_from_resolved(self):
        rows = [{'facilityId': 'a'}, {'facilityId': 'b'}, {'facilityId': 'c'}]
        queue = {'pending': [{'facilityId': 'a', 'facilityIds': ['a', 'b']}],
                 'answered': [{'facilityId': 'c', 'facilityIds': ['c', 'already-adopted'],
                               'status': 'answered-partially-unresolved'}]}
        r.attach_human_queue(rows, queue, 'queue.json')
        self.assertEqual(rows[1]['humanConfirmationRef'], 'queue.json#/pending/0')
        self.assertEqual(rows[2]['humanConfirmationRef'], 'queue.json#/answered/0')
        queue['pending'].append({'facilityId': 'c'})
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            r.attach_human_queue(rows, queue, 'queue.json')
        with self.assertRaisesRegex(ValueError, 'outside'):
            r.attach_human_queue(rows, {'pending': [{'facilityId': 'unknown'}]}, 'queue.json')

    def test_repository_population_and_history(self):
        result = r.build(ROOT, '11b7e4ee', '2026-11-05')
        ledger, _ = assemble.assemble(ROOT, assemble.read_json(ROOT / 'tools/national/manifest.json'))
        self.assertEqual(result['summary']['unlocated'], sum(not p.get('coordinate') for p in ledger['places']))
        fixed = json.loads((ROOT / 'data/evidence/issue57/remaining-index-initial.json').read_text())
        self.assertEqual(fixed['summary']['unlocated'], 588)
        rows = {x['facilityId']: x for x in result['facilities']}
        row = rows['facility:north-proposal-akita-guard']
        refs = [h['ref'] for h in row['history']]
        self.assertTrue(any('issue16' in ref for ref in refs))
        self.assertTrue(any('issue20' in ref for ref in refs))
        self.assertTrue(row['latestResultRef'].startswith('data/national/issue20/'))
        self.assertEqual(len(rows), len(result['facilities']))
        self.assertTrue(all(x['history'] and x['nextAction'] for x in rows.values()))
        daito = rows['facility:kinki-5ef4b8538c8df02b55f4']
        self.assertEqual(daito['latestResultRef'], 'data/national/issue27/outcomes.json#/facilities/0')
        fukui = next(x for x in rows.values() if '復原町並' in x['name'])
        self.assertFalse(any('/kinki-east/' in h['ref'] or '/kinki-west/' in h['ref'] for h in fukui['history']))

if __name__ == '__main__': unittest.main()
