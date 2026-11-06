import copy
import unittest

from issue76_remaining import remaining_rows


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


if __name__ == '__main__':
    unittest.main()
