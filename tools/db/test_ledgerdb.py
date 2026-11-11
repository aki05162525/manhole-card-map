import copy
from contextlib import closing
import json
import re
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

import ledgerdb as db

ROOT = Path(__file__).resolve().parents[2]
RESEARCH_CONTENT = ('status', 'stage', 'blockers', 'finding', 'stop_condition', 'resume_condition', 'next_action',
                    'next_source_urls', 'next_source')


class RepositoryRowsTest(unittest.TestCase):
    def test_build_then_dump_keeps_row_files(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            with closing(db.build(ROOT)) as database:
                db.dump(database, out)
            expected = sorted(p.name for p in (ROOT / db.ROWS).glob('*.jsonl'))
            self.assertEqual(sorted(p.name for p in out.iterdir()), expected)
            for name in expected:
                self.assertEqual((out / name).read_bytes(), (ROOT / db.ROWS / name).read_bytes(), name)

    def test_card_tables_match_registry(self):
        with closing(db.build(ROOT)) as database:
            registry = db.export_card_ids(database)
        self.assertEqual(registry, json.loads((ROOT / 'data/card-ids.json').read_text(encoding='utf-8')))


class ConstraintTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = db.read_rows(ROOT)

    def setUp(self):
        self.rows = copy.deepcopy(self.rows)

    def rejected(self, *fragments):
        with self.assertRaises(db.LedgerError) as raised:
            db.load(self.rows)
        for fragment in fragments:
            self.assertIn(fragment, str(raised.exception))

    def first(self, table, **match):
        return next(r for r in self.rows[table] if all(r[k] == v for k, v in match.items()))

    def test_relation_to_unknown_card(self):
        relation = self.rows['relation'][0]
        relation['card_id'] = '99-999-Z999'
        self.rejected(f"relation ('{relation['id']}',)", 'FOREIGN KEY', 'card')

    def test_relation_to_unknown_facility(self):
        relation = self.rows['relation'][0]
        relation['facility_id'] = 'facility:missing'
        self.rejected(f"relation ('{relation['id']}',)", 'FOREIGN KEY', 'facility')

    def test_legacy_id_belongs_to_one_facility(self):
        legacy = self.rows['facility_legacy_id'][0]
        other = next(f['id'] for f in self.rows['facility'] if f['id'] != legacy['facility_id'])
        self.rows['facility_legacy_id'].append(dict(legacy, facility_id=other))
        self.rejected('facility_legacy_id', 'UNIQUE')

    def test_same_card_facility_and_period(self):
        duplicate = dict(self.rows['relation'][0], id='relation:duplicate')
        self.rows['relation'].append(duplicate)
        self.rejected("relation ('relation:duplicate',)", 'UNIQUE')

    def test_other_period_of_same_card_and_facility_is_allowed(self):
        first = self.rows['relation'][0]
        first.update(valid_from=None, valid_to='2098-12-31')
        self.rows['relation'].append(dict(first, id='relation:later', valid_from='2099-01-01', valid_to=None))
        db.load(self.rows).close()

    def test_periods_of_same_card_and_facility_must_not_overlap(self):
        first = self.rows['relation'][0]
        for start, end, other_start, other_end in [(None, None, '2099-01-01', None),
                                                    ('2099-01-01', '2099-05-31', '2099-05-31', '2099-10-31'),
                                                    (None, '2099-05-31', None, '2098-01-01')]:
            rows = copy.deepcopy(self.rows)
            rows['relation'][0].update(valid_from=start, valid_to=end)
            rows['relation'].append(dict(rows['relation'][0], id='relation:later', valid_from=other_start,
                                         valid_to=other_end))
            with self.assertRaises(db.LedgerError) as raised:
                db.load(rows)
            self.assertIn('overlapping periods', str(raised.exception))

    def test_latitude_out_of_range(self):
        decision = self.first('location_decision', action='adopt')
        decision['lat'] = 90.5
        self.rejected(f"location_decision ('{decision['facility_id']}', 1)", 'CHECK', 'lat')

    def test_actor_other_than_ai_or_human(self):
        evidence = self.rows['evidence'][0]
        evidence['actor_type'] = 'phone'
        self.rejected(f"evidence ('{evidence['id']}',)", 'CHECK', 'actor_type')

    def test_correction_must_follow_an_adoption(self):
        decision = self.first('location_decision', action='adopt')
        self.rows['location_decision'].append(dict(
            decision, seq=3, action='correct', reason='r', reviewed_at='2099-01-01', lat=0.0, lng=0.0, scope=None,
            provenance=None))
        self.rejected(f"location_decision ('{decision['facility_id']}', 3)", 'previous decision')

    def test_decision_cannot_predate_its_evidence(self):
        decision = self.first('location_decision', action='correct')
        source = self.first('evidence', id=decision['evidence_id'])
        later = dict(source, id='evidence:later', checked_at='2099-01-01')
        self.rows['evidence'].append(later)
        decision['evidence_id'] = later['id']
        self.rejected(f"location_decision ('{decision['facility_id']}', 2)", 'predates its evidence')

    def test_hours_must_be_an_array_of_strings(self):
        relation = self.rows['relation'][0]
        relation['hours'] = '9:00-17:00'
        self.rejected(f"relation ('{relation['id']}',)", 'hours')

    def test_research_on_unknown_facility(self):
        research = self.rows['location_research'][0]
        research['facility_id'] = 'facility:missing'
        self.rejected(f"location_research ('facility:missing', '{research['source_ref']}')", 'FOREIGN KEY', 'facility')

    def test_research_on_located_facility(self):
        located = self.first('location_decision', action='adopt')['facility_id']
        self.rows['location_research'].append(dict(self.rows['location_research'][0], facility_id=located))
        self.rejected(f"location_research ('{located}',", 'has a current location')

    def test_research_needs_some_content(self):
        research = self.rows['location_research'][0]
        research.update(dict.fromkeys(RESEARCH_CONTENT))
        self.rejected('location_research', 'CHECK')

    def test_research_may_record_only_the_next_source(self):
        research = self.rows['location_research'][0]
        research.update(dict.fromkeys(RESEARCH_CONTENT), next_source_urls=['https://example.org/next'])
        db.load(self.rows).close()

    def test_source_review_status(self):
        review = self.rows['source_review'][0]
        review['status'] = 'approved'
        self.rejected(f"source_review ('{review['id']}',)", 'CHECK', 'status')

    def test_source_review_evidence_after_review(self):
        evidence = self.rows['source_review_evidence'][0]
        evidence['checked_at'] = '2099-01-01'
        self.rejected(f"source_review_evidence ('{evidence['review_id']}', '{evidence['url']}')", 'checked after its review')

    def test_review_target_needs_a_decision(self):
        target = self.rows['source_review_target'][0]
        target['seq'] = 99
        self.rejected(f"source_review_target ('{target['facility_id']}', 99)", 'FOREIGN KEY', 'location_decision')

    def test_attempt_needs_its_research_row(self):
        attempt = self.rows['location_research_attempt'][0]
        attempt['source_ref'] = 'missing.json#/0'
        self.rejected(f"location_research_attempt ('{attempt['facility_id']}', 'missing.json#/0', 0)",
                      'FOREIGN KEY', 'location_research')

    def test_attempt_positions_have_no_gap(self):
        attempt = self.rows['location_research_attempt'][0]
        self.rows['location_research_attempt'].append(dict(attempt, position=999))
        self.rejected(f"location_research_attempt ('{attempt['facility_id']}', '{attempt['source_ref']}')",
                      'positions must be 0..n-1')

    def test_candidate_on_located_facility(self):
        located = self.first('location_decision', action='adopt')['facility_id']
        self.rows['location_candidate'].append(dict(self.rows['location_candidate'][0], facility_id=located))
        self.rejected(f"location_candidate ('{located}',", 'has a current location')

    def test_recheck_needs_a_current_location(self):
        unlocated = self.rows['location_research'][0]['facility_id']
        self.rows['location_recheck'].append(dict(self.rows['location_recheck'][0], facility_id=unlocated))
        self.rejected(f"location_recheck ('{unlocated}',", 'has no current location')

    def test_user_answer_is_human(self):
        answer = self.rows['user_answer'][0]
        answer['actor_type'] = 'ai'
        self.rejected(f"user_answer ('{answer['source_ref']}',)", 'CHECK', 'actor_type')

    def test_user_answer_needs_a_facility(self):
        ref = self.rows['user_answer'][0]['source_ref']
        self.rows['user_answer_facility'] = [r for r in self.rows['user_answer_facility'] if r['source_ref'] != ref]
        self.rejected(f"user_answer ('{ref}',)", 'needs a facility')

    def test_user_answer_on_unknown_facility(self):
        link = self.rows['user_answer_facility'][0]
        link['facility_id'] = 'place:unknown'
        self.rejected(f"user_answer_facility ('{link['source_ref']}', 'place:unknown')", 'FOREIGN KEY', 'facility')

    def test_values_that_sqlite_would_convert_are_rejected(self):
        decision = self.first('location_decision', action='adopt')
        key = f"location_decision ('{decision['facility_id']}', "
        for column, value in [('lat', True), ('lat', '35.1'), ('lat', float('nan')), ('lng', float('inf')),
                              ('lng', -float('inf')), ('seq', 1.0), ('seq', '1'), ('seq', True),
                              ('evidence_id', 1), ('scope', False)]:
            rows = copy.deepcopy(self.rows)
            next(d for d in rows['location_decision'] if d['facility_id'] == decision['facility_id'])[column] = value
            with self.assertRaises(db.LedgerError, msg=f'{column}={value!r}') as raised:
                db.load(rows)
            self.assertRegex(str(raised.exception), re.escape(key) + r"[^)]*\): " + column + ' must be')

    def test_integer_and_text_columns_of_other_tables(self):
        for table, column, value in [('location_research_attempt', 'position', 0.0), ('location_research_attempt', 'http_status', '200'),
                                     ('relation', 'status', 1), ('source_review_evidence', 'checked_at', False)]:
            rows = copy.deepcopy(self.rows)
            rows[table][0][column] = value
            with self.assertRaises(db.LedgerError, msg=f'{table}.{column}') as raised:
                db.load(rows)
            self.assertIn(f'{column} must be', str(raised.exception))

    def test_non_finite_number_inside_a_json_object(self):
        decision = next(d for d in self.rows['location_decision'] if d['provenance'])
        decision['provenance'] = dict(decision['provenance'], extra=float('nan'))
        self.rejected(f"location_decision ('{decision['facility_id']}', 1)", 'provenance')

    def test_row_file_with_a_repeated_key_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db.write_rows(self.rows, root / db.ROWS)
            path = root / db.ROWS / 'card.jsonl'
            lines = path.read_text(encoding='utf-8').splitlines()
            lines[0] = lines[0][:-1] + ', "id": "other"}'
            path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
            with self.assertRaisesRegex(db.LedgerError, 'card line 1: repeated key id'):
                db.read_rows(root)

    def test_cli_reports_table_and_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / db.ROWS).mkdir(parents=True)
            self.rows['relation'][0]['status'] = 'open'
            db.write_rows(self.rows, root / db.ROWS)
            result = subprocess.run([sys.executable, '-B', str(Path(db.__file__)), 'build', '--root', str(root),
                                     '--check'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f"relation ('{self.rows['relation'][0]['id']}',)", result.stderr)
        self.assertIn('status', result.stderr)


def synthetic_rows():
    """Four facilities: f1 adopted without a review record, f2 never located, f3 adopted then withdrawn, f4 adopted."""
    ev = dict(id='evidence:a', source_url='https://example.org/a', snapshot_sha256='a' * 64,
              legacy_snapshot_path='data/evidence/a', source_locator='p1', checked_at='2026-01-01', actor_type='ai',
              verification_method='read')
    facilities = [dict(id=f, name=f'name {f}', address=f'address {f}', phone='', identity_evidence_id=ev['id'])
                  for f in ('f1', 'f2', 'f3', 'f4')]

    def decision(fid, seq, action, **extra):
        row = dict(facility_id=fid, seq=seq, action=action, lat=35.0, lng=139.0, scope='building', evidence_id=ev['id'],
                   provenance=None, reviewed_at='2026-01-01', reason='Adopted building representative point',
                   source_version=None)
        row.update(extra)
        return row

    relation = dict(condition=None, hours=[], maintenance_notes=None, change_kind=None, change_reason=None,
                    change_previous_place_ids=None, change_raw=None, source_hash='b' * 64, evidence_id=ev['id'],
                    valid_from=None, valid_to=None)
    research = dict(work_unit='w', researched_at='2026-02-01', stage=None, blockers=None, stop_condition=None,
                    resume_condition=None, next_action=None, next_source_urls=None, next_source=None)
    answer = dict(work_unit='w', actor_type='human', answered_at='2026-02-02', question=None)
    return dict(
        card=[dict(id='c1'), dict(id='c2')], card_alias=[], card_excluded=[], evidence=[ev], facility=facilities,
        facility_legacy_id=[],
        relation=[dict(relation, id='r1', card_id='c1', facility_id='f1', status='active', review_until='2026-05-31'),
                  dict(relation, id='r2', card_id='c1', facility_id='f2', status='active', review_until='2026-06-01'),
                  dict(relation, id='r3', card_id='c2', facility_id='f3', status='ended', review_until=None)],
        location_decision=[decision('f1', 1, 'adopt', scope=None, reviewed_at=None, reason=None),
                           decision('f3', 1, 'adopt'),
                           decision('f3', 2, 'withdraw', lat=None, lng=None, scope=None, reason='withdrawn'),
                           decision('f4', 1, 'adopt')],
        building_group=[dict(id='g', evidence_id=ev['id'])],
        building_group_member=[dict(facility_id='f3', group_id='g'), dict(facility_id='f4', group_id='g')],
        location_research=[dict(research, facility_id='f2', source_ref='a.json#/0', status='held', finding='x'),
                           dict(research, facility_id='f2', source_ref='b.json#/0', status=None, finding='y',
                                next_source='z')],
        location_research_attempt=[dict(facility_id='f2', source_ref='a.json#/0', position=i, kind='fetch',
                                        source_url='https://example.org/p', http_status=200, result='r', error=None,
                                        attempted_at='2026-02-01T00:00:00+00:00', snapshot_sha256=None)
                                   for i in range(2)],
        location_candidate=[dict(facility_id='f2', source_ref='c.json#/0', work_unit='w', lat=35.0, lng=139.0,
                                 scope=None, source_url='https://example.org/c', source_locator=None, checked_at=None,
                                 review_ref='r.json#/0', review_status='deferred', review_reason='q')],
        location_recheck=[dict(facility_id='f1', source_ref='d.json#/0', work_unit='w', kind='移転別棟', text='t'),
                          dict(facility_id='f4', source_ref='d.json#/1', work_unit='w', kind='座標競合', text='t')],
        user_answer=[dict(answer, source_ref='h.json#/0', answer='a1'), dict(answer, source_ref='h.json#/1', answer='a2')],
        user_answer_facility=[dict(source_ref='h.json#/0', facility_id='f2'), dict(source_ref='h.json#/0', facility_id='f4'),
                              dict(source_ref='h.json#/1', facility_id='f1')],
        source_review=[dict(id='s', source_name='n', source_version='v', source_derivation='d',
                            status='needs-review', checked_at='2026-01-02', actor_type='ai', conditions='c', notes=None)],
        source_review_evidence=[dict(review_id='s', url='https://example.org/t', locator='l',
                                     checked_at='2026-01-02')],
        source_review_target=[dict(facility_id='f4', seq=1, review_id='s')])


def places(rows):
    with closing(db.load(rows)) as database:
        return {p['id']: p for p in json.loads(db.export_ledger(database))['places']}


class SummaryTest(unittest.TestCase):
    def test_counts_synthetic_rows(self):
        with closing(db.load(synthetic_rows())) as database:
            result = db.summary(database, '2026-06-01')
        self.assertEqual(result['facilities'], dict(total=4, byLocation=dict(located=2, none=1, withdrawn=1)))
        relations = result['relations']
        self.assertEqual((relations['byStatus'], relations['pastReviewUntil']), (dict(active=2, ended=1), 1))
        self.assertEqual(relations['pastReviewUntilRows'][0]['id'], 'r1')
        # f2 has research with a next source, a candidate and an answer; withdrawn f3 has no research.
        self.assertEqual(result['unlocated'], dict(withResearch=1, withNextSource=1, withCandidates=1,
                                                   withUserAnswers=1, withoutResearch=1, withoutResearchIds=['f3']))
        self.assertEqual(result['locationRechecks'], dict(facilities=2, byKind={'移転別棟': 1, '座標競合': 1}))
        self.assertEqual(result['sourceReviews'], dict(byStatus={'needs-review': 1},
                                                       locatedByStatus={'needs-review': 1, 'none': 1}))


class ExportTest(unittest.TestCase):
    """The current decision gives the coordinate; a decision with reason gives locationReview."""

    def follow(self, rows, **extra):
        row = dict(rows['location_decision'][0], seq=2, action='correct', lat=35.1, lng=139.1,
                   reviewed_at='2026-01-02', reason='corrected')
        row.update(extra)
        rows['location_decision'].append(row)
        return row

    def test_adoption_without_reason_has_no_location_review(self):
        place = places(synthetic_rows())['f1']
        self.assertEqual(place['coordinate'], dict(lat=35.0, lng=139.0))
        self.assertNotIn('locationReview', place)

    def test_correction_after_an_adoption_without_reason(self):
        rows = synthetic_rows()
        self.follow(rows)
        place = places(rows)['f1']
        self.assertEqual(place['coordinate'], dict(lat=35.1, lng=139.1))
        self.assertEqual(place['locationReview'], dict(status='confirmed', addressStatus='valid', reason='corrected',
                                                       reviewedAt='2026-01-02'))

    def test_withdrawal_drops_the_coordinate(self):
        rows = synthetic_rows()
        rows['location_recheck'] = [r for r in rows['location_recheck'] if r['facility_id'] != 'f1']
        self.follow(rows, action='withdraw', lat=None, lng=None)
        place = places(rows)['f1']
        self.assertNotIn('coordinate', place)
        self.assertEqual(place['locationReview']['status'], 'withdrawn')

    def test_follow_up_cannot_predate_the_previous_evidence(self):
        rows = synthetic_rows()
        rows['evidence'].append(dict(rows['evidence'][0], id='evidence:older', checked_at='2025-01-01'))
        self.follow(rows, evidence_id='evidence:older', reviewed_at='2025-06-01')
        with self.assertRaisesRegex(db.LedgerError, r"location_decision \('f1', 2\): must follow"):
            db.load(rows)

    def test_reaffirm_keeps_and_correct_changes_the_coordinate(self):
        for action, lat in [('reaffirm', 35.1), ('correct', 35.0)]:
            rows = synthetic_rows()
            self.follow(rows, action=action, lat=lat, lng=139.0)
            with self.assertRaisesRegex(db.LedgerError, r"location_decision \('f1', 2\): reaffirm must keep"):
                db.load(rows)


class UntrackedOriginalTest(unittest.TestCase):
    """New evidence keeps no snapshot path: the original stays out of Git (docs/data-maintenance.md)."""

    def adopt(self):
        rows = synthetic_rows()
        ev = dict(rows['evidence'][0], id='evidence:new', source_locator='p2', legacy_snapshot_path=None,
                  checked_at='2026-02-01T09:30:00+09:00')
        rows['evidence'].append(ev)
        for table in ('location_research_attempt', 'location_research', 'location_candidate'):
            rows[table] = [r for r in rows[table] if r['facility_id'] != 'f2']
        rows['location_decision'].append(dict(rows['location_decision'][-1], facility_id='f2', lat=35.2, lng=139.2,
                                              evidence_id=ev['id'], reviewed_at='2026-02-01'))
        return rows, ev

    def test_adoption_without_snapshot_path(self):
        rows, ev = self.adopt()
        evidence = places(rows)['f2']['evidence']
        self.assertNotIn('snapshotPath', evidence)
        self.assertEqual((evidence['snapshotSHA256'], evidence['checkedAt']), (ev['snapshot_sha256'], '2026-02-01'))

    def test_snapshot_path_may_be_null_but_not_empty(self):
        rows, ev = self.adopt()
        ev['legacy_snapshot_path'] = ''
        self.assertRaises(db.LedgerError, db.load, rows)


class CardRegistryTest(unittest.TestCase):
    def test_import_replaces_card_tables_from_registry(self):
        rows = synthetic_rows()
        registry = dict(ids=['c1', 'c2', 'c3', 'c4'], aliases={'c3': 'c1'}, excluded={'c4': 'withdrawn number'})
        with closing(db.load(db.with_card_ids(rows, registry))) as database:
            self.assertEqual(db.export_card_ids(database), registry)
        self.assertEqual([r['id'] for r in rows['card']], ['c1', 'c2'])

    def test_import_keeps_cards_that_relations_use(self):
        registry = dict(ids=['c1'], aliases={}, excluded={})
        with self.assertRaisesRegex(db.LedgerError, 'FOREIGN KEY'):
            db.load(db.with_card_ids(synthetic_rows(), registry))

    def test_cli_writes_row_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            db.write_rows(synthetic_rows(), root / db.ROWS)
            registry = dict(ids=['c1', 'c2', 'c3'], aliases={}, excluded={})
            (root / 'data/card-ids.json').write_text(json.dumps(registry), encoding='utf-8')
            subprocess.run([sys.executable, '-B', str(Path(db.__file__)), 'import-card-ids', '--root', str(root)],
                           check=True)
            self.assertEqual((root / db.ROWS / 'card.jsonl').read_text(encoding='utf-8').splitlines(),
                             ['{"id": "c1"}', '{"id": "c2"}', '{"id": "c3"}'])


if __name__ == '__main__':
    unittest.main()
