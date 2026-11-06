"""The adoption gate binds explicit review to unchanged assessed inputs."""
import copy
import unittest
from pathlib import Path

from assemble import assemble, read_json

from issue76_adoption import approved_ids
from location_lifecycle import digest


class AdoptionGateTests(unittest.TestCase):
    def setUp(self):
        self.rows = [dict(facilityId='one', recommendation='propose',
                          positionSuitability={'status': 'acceptable'}),
                     dict(facilityId='two', recommendation='hold',
                          positionSuitability={'status': 'held'})]
        self.common = {'scope': 'versioned product evidence'}
        self.review = dict(status='approved', reviewer='independent-codex',
                           evidence=['review-result'],
                           assessmentSHA256=digest(self.rows),
                           commonSHA256=digest(self.common), approvedIds=['one'])

    def test_explicit_subset_only(self):
        self.assertEqual({'one'}, approved_ids(self.rows, self.common, self.review))
        self.review['approvedIds'] = []
        self.assertEqual(set(), approved_ids(self.rows, self.common, self.review))

    def test_missing_pending_or_unbound_review_rejected(self):
        for field, value in [('status', 'pending'), ('reviewer', ''), ('evidence', []),
                             ('assessmentSHA256', 'old'), ('commonSHA256', 'old')]:
            with self.subTest(field=field), self.assertRaises(ValueError):
                approved_ids(self.rows, self.common, dict(self.review, **{field: value}))

    def test_held_unknown_and_duplicate_approvals_rejected(self):
        for ids in [['two'], ['missing'], ['one', 'one']]:
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                approved_ids(self.rows, self.common, dict(self.review, approvedIds=ids))

    def test_changed_assessment_cannot_inherit_approval(self):
        changed = copy.deepcopy(self.rows)
        changed[0]['positionSuitability']['status'] = 'held'
        with self.assertRaises(ValueError):
            approved_ids(changed, self.common, self.review)


class AdoptedLedgerTests(unittest.TestCase):
    def test_reviewed_saitama_locations_reach_current_ledger_only(self):
        root = Path(__file__).resolve().parents[2]
        prefix = root / 'data/national/issue76/saitama'
        review = read_json(prefix / 'review.json')
        package = read_json(prefix / 'review-inputs.json')
        rows = read_json(prefix / 'assessment.json')['outcomes']
        selected = approved_ids(rows, package['common'], review)
        manifest = read_json(root / 'tools/national/manifest.json')
        before_manifest = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            before_manifest[key] = [r for r in manifest[key]
                                    if not r['path'].startswith('data/national/issue76/saitama/')]
        before, _ = assemble(root, before_manifest)
        after, _ = assemble(root, manifest)
        self.assertEqual(before['relations'], after['relations'])
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(selected, {fid for fid in old if old[fid] != new[fid]})
        candidates = {r['facilityId']: r for r in read_json(root / 'data/national/kanto-prefecture/saitama/full-locations.json')['updates']}
        for fid in selected:
            self.assertEqual(candidates[fid]['coordinate'], new[fid]['coordinate'])
            self.assertEqual({k for k in old[fid].keys() | new[fid].keys()
                              if old[fid].get(k) != new[fid].get(k)},
                             {'coordinate', 'evidence', 'locationReview'})


if __name__ == '__main__':
    unittest.main()
