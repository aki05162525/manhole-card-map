"""The adoption gate binds explicit review to unchanged assessed inputs."""
import copy
import unittest
from pathlib import Path
from unittest.mock import patch

from assemble import assemble, read_json

from issue76_adoption import approved_ids, prepare_county
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
    def test_adoption_documents_reproduce_from_reviewed_inputs(self):
        root = Path(__file__).resolve().parents[2]
        baseline, _ = assemble(root, read_json(root / 'data/evidence/issue76/baseline-manifest.json'))
        for review_path in sorted((root / 'data/national/issue76').rglob('review.json')):
            prefix = review_path.parent
            with self.subTest(county=prefix.name):
                actual = prepare_county(root, str(prefix.relative_to(root / 'data/national/issue76')), baseline)
                expected = tuple(read_json(prefix / name) for name in
                                 ('locations.json', 'location-lifecycle.json', 'adoption-provenance.json'))
                self.assertEqual(expected, actual)

    def test_review_bound_source_description_overrides_gsi_default(self):
        root = Path(__file__).resolve().parents[2]
        baseline, _ = assemble(root, read_json(root / 'data/evidence/issue76/baseline-manifest.json'))
        prefix = root / 'data/national/issue76/saitama'
        assessment = copy.deepcopy(read_json(prefix / 'assessment.json'))
        review = copy.deepcopy(read_json(prefix / 'review.json'))
        row = next(r for r in assessment['outcomes'] if r['facilityId'] in review['approvedIds'])
        row['adoptionMethod'] = '公式配置図から導出した代表点。'
        row['sourceVersion'] = 'official diagram mapped representative point'
        review['assessmentSHA256'] = digest(assessment['outcomes'])
        def read(path):
            if path == prefix / 'assessment.json':
                return assessment
            if path == prefix / 'review.json':
                return review
            return read_json(path)
        with patch('issue76_adoption.read_json', side_effect=read):
            locations, lifecycle, _ = prepare_county(root, 'saitama', baseline)
        update = next(r for r in locations['updates'] if r['facilityId'] == row['facilityId'])
        self.assertTrue(update['evidence']['verificationMethod'].startswith(row['adoptionMethod']))
        binding = next(r for r in lifecycle['bindings'] if r['facilityId'] == row['facilityId'])
        self.assertEqual(row['sourceVersion'], binding['sourceVersion'])

    def test_human_approved_subset_is_applied_without_other_changes(self):
        root = Path(__file__).resolve().parents[2]
        from issue60_adoption import prepare
        for path, expected in prepare(root).items():
            self.assertEqual(expected, read_json(root / path), path)
        review = read_json(root / 'data/evidence/issue60/human-answers-20261106/round2/adoption-review.json')
        manifest = read_json(root / 'tools/national/manifest.json')
        # Replay the historical 15-row adoption independently of later followups.
        for key in ('locations', 'locationLifecycle'):
            manifest[key] = [r for r in manifest[key]
                             if '/kinugasa-followup/' not in r['path'] and '/four-followup/' not in r['path'] and '/twelve-followup/' not in r['path']]
        before_manifest = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            before_manifest[key] = [r for r in manifest[key] if '/human-followup/' not in r['path']]
        before, _ = assemble(root, before_manifest)
        after, _ = assemble(root, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual(1670, len(after['relations']))
        self.assertEqual(set(review['approvedIds']), {fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(490, sum(p.get('coordinate') is None for p in old.values()))
        self.assertEqual(475, sum(p.get('coordinate') is None for p in new.values()))
        for fid in review['heldIds']:
            self.assertIsNone(new[fid].get('coordinate'))

    def test_existing_coordinate_cannot_be_overwritten(self):
        root = Path(__file__).resolve().parents[2]
        baseline, _ = assemble(root, read_json(root / 'data/evidence/issue76/baseline-manifest.json'))
        fid = read_json(root / 'data/national/issue76/saitama/review.json')['approvedIds'][0]
        next(p for p in baseline['places'] if p['id'] == fid)['coordinate'] = {'lat': 35, 'lng': 139}
        with self.assertRaisesRegex(ValueError, 'existing unlocated facility'):
            prepare_county(root, 'saitama', baseline)

    def test_only_explicitly_reviewed_locations_reach_current_ledger(self):
        root = Path(__file__).resolve().parents[2]
        selected, candidates = set(), {}
        for review_path in sorted((root / 'data/national/issue76').rglob('review.json')):
            prefix = review_path.parent
            review = read_json(review_path)
            package = read_json(prefix / 'review-inputs.json')
            rows = read_json(prefix / 'assessment.json')['outcomes']
            county_ids = approved_ids(rows, package['common'], review)
            self.assertFalse(selected & county_ids)
            selected.update(county_ids)
            for row in rows:
                if row['facilityId'] in county_ids:
                    source = read_json(root / row['sourceLocationPath'])
                    candidate = next(r for r in source['updates'] if r['facilityId'] == row['facilityId'])
                    self.assertEqual(digest(candidate), row['sourceLocationSHA256'])
                    candidates[row['facilityId']] = candidate
        manifest = read_json(root / 'tools/national/manifest.json')
        before_manifest = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            before_manifest[key] = [r for r in manifest[key]
                                    if not r['path'].startswith('data/national/issue76/')]
        before, _ = assemble(root, before_manifest)
        after, _ = assemble(root, manifest)
        self.assertEqual(before['relations'], after['relations'])
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(selected, {fid for fid in old if old[fid] != new[fid]})
        for fid in selected:
            self.assertEqual(candidates[fid]['coordinate'], new[fid]['coordinate'])
            self.assertEqual({k for k in old[fid].keys() | new[fid].keys()
                              if old[fid].get(k) != new[fid].get(k)},
                             {'coordinate', 'evidence', 'locationReview'})


if __name__ == '__main__':
    unittest.main()
