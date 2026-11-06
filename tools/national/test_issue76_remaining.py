import copy
import unittest

from issue76_remaining import remaining_rows, merge_assessment_packages
from location_lifecycle import digest


class RemainingIndexTests(unittest.TestCase):
    def setUp(self):
        self.ledger = {'places': [
            {'id': 'adopted', 'name': '採用', 'address': 'A', 'coordinate': {'lat': 35, 'lng': 139}},
            {'id': 'held', 'name': '保留', 'address': 'B'},
            {'id': 'other', 'name': '他地域', 'address': 'C'}]}
        self.history = {'facilities': [dict(facilityId=fid) for fid in ('adopted', 'held', 'other')]}
        self.assessments = {'held': {'county': 'test', 'assessmentRef': 'assessment.json#/outcomes/0',
            'reviewRef': 'review.json', 'row': {'recommendation': 'hold', 'nextAction': '現棟図を取得',
                'positionSuitability': {'buildingAssessment': {'remainingGap': '旧棟しかない'}}}}}

    def test_adopted_excluded_and_held_reason_and_history_preserved(self):
        rows = remaining_rows(self.ledger, self.history, self.assessments, {'adopted'})
        self.assertEqual(['held', 'other'], [r['facilityId'] for r in rows])
        self.assertEqual('旧棟しかない', rows[0]['reason'])
        self.assertEqual('現棟図を取得', rows[0]['nextAction'])
        self.assertEqual('data/national/issue57/remaining-index.json#/facilities/2', rows[1]['historyRef'])
        self.assertNotIn('reason', rows[1])  # Do not invent a new assessment of other regions.

    def test_unapplied_approval_and_located_hold_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        del ledger['places'][0]['coordinate']
        with self.assertRaisesRegex(ValueError, 'approval not applied'):
            remaining_rows(ledger, self.history, self.assessments, {'adopted'})
        ledger = copy.deepcopy(self.ledger)
        ledger['places'][1]['coordinate'] = {'lat': 35, 'lng': 139}
        with self.assertRaisesRegex(ValueError, 'held facility already located'):
            remaining_rows(ledger, self.history, self.assessments, {'adopted'})

    def test_duplicate_or_missing_history_rejected(self):
        history = copy.deepcopy(self.history)
        history['facilities'].append(history['facilities'][0])
        with self.assertRaisesRegex(ValueError, 'duplicate historical'):
            remaining_rows(self.ledger, history, self.assessments, {'adopted'})
        with self.assertRaisesRegex(ValueError, 'missing historical'):
            remaining_rows(self.ledger, {'facilities': []}, self.assessments, {'adopted'})


class FollowupAssessmentTests(unittest.TestCase):
    @staticmethod
    def package(path, data, approved):
        common = {'scope': 'same-product'}
        return dict(path=path, data=data, sha256=digest(data), common=common,
                    review=dict(status='approved', reviewer='independent', evidence=['review'],
                                assessmentSHA256=digest(data['outcomes']),
                                commonSHA256=digest(common), approvedIds=approved))

    def setUp(self):
        held = dict(facilityId='yoshioka', recommendation='hold',
                    positionSuitability={'status': 'held'})
        self.old = self.package('data/gunma/assessment.json',
                                dict(county='gunma', outcomes=[held]), [])
        proposed = dict(facilityId='yoshioka', recommendation='propose',
                        positionSuitability={'status': 'acceptable'})
        self.followup = self.package('data/gunma/followup/assessment.json',
            dict(county='gunma', outcomes=[proposed], supersedes={
                'assessmentPath': self.old['path'], 'assessmentSHA256': self.old['sha256']}),
            ['yoshioka'])

    def test_reviewed_followup_replaces_only_held_row_without_double_count(self):
        rows, approved, counties = merge_assessment_packages([self.old, self.followup])
        self.assertEqual({'yoshioka'}, approved)
        self.assertEqual(1, len(rows))
        self.assertEqual('data/gunma/followup/assessment.json#/outcomes/0',
                         rows['yoshioka']['assessmentRef'])
        self.assertEqual({'gunma': {'assessed': 1, 'adopted': 1, 'held': 0}}, counties)
        self.assertEqual('hold', self.old['data']['outcomes'][0]['recommendation'])

    def test_unapproved_stale_wrong_county_or_wrong_source_followup_rejected(self):
        for change in ('unapproved', 'stale', 'county', 'source'):
            followup = copy.deepcopy(self.followup)
            if change == 'unapproved':
                followup['review']['approvedIds'] = []
            elif change == 'stale':
                followup['data']['supersedes']['assessmentSHA256'] = 'stale'
            elif change == 'county':
                followup['data']['county'] = 'tokyo'
            else:
                followup['data']['supersedes']['assessmentPath'] = 'data/other/assessment.json'
            with self.subTest(change=change), self.assertRaises(ValueError):
                merge_assessment_packages([self.old, followup])

    def test_undeclared_duplicate_or_previously_approved_replacement_rejected(self):
        followup = copy.deepcopy(self.followup)
        del followup['data']['supersedes']
        with self.assertRaisesRegex(ValueError, 'duplicate county assessment'):
            merge_assessment_packages([self.old, followup])
        old = self.package(self.old['path'], dict(county='gunma',
            outcomes=copy.deepcopy(self.followup['data']['outcomes'])), ['yoshioka'])
        followup = copy.deepcopy(self.followup)
        followup['data']['supersedes']['assessmentSHA256'] = old['sha256']
        with self.assertRaisesRegex(ValueError, 'only an unapproved hold'):
            merge_assessment_packages([old, followup])


if __name__ == '__main__':
    unittest.main()
